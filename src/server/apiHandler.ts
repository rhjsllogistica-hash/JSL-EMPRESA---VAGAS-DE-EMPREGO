import { z } from 'zod';
import {
  availabilitySchema,
  calculateWorkDuration,
  contactMessageSchema,
  educationSchema,
  personalSchema,
  workExperienceSchema,
} from '../lib/validation.ts';
import { APPLICATION_STATUSES } from '../types/recruitment.ts';
import {
  base64ToUint8,
  escapeCsvCell,
  generateRandomTokenHex,
  saoPauloDateToUtcBounds,
  sha256Hex,
  uint8ToBase64,
  verifyPasswordPBKDF2,
} from './cryptoUtils.ts';
import { D1Database, D1PreparedStatement, WorkerEnv } from './d1Types.ts';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const CHUNK_SIZE_BYTES = 192 * 1024; // 192 KB -> ~256 KB base64 (< 2 MB limite por linha do D1)
const SESSION_COOKIE_NAME = 'jsl_session';
const SESSION_TTL_SECONDS = 8 * 60 * 60; // 8 horas

// Hash PBKDF2 dummy válido para mitigar enumeração de usuários por tempo de resposta
const DUMMY_PBKDF2_HASH =
  'pbkdf2_sha256$100000$00000000000000000000000000000000$0000000000000000000000000000000000000000000000000000000000000000';

export interface AdminSession {
  userId: number;
  username: string;
  displayName: string;
  tenantId: 1 | 2;
  channelPath: '/vagas1' | '/vagas2';
  tokenHash: string;
}

function jsonResponse(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store',
      ...headers,
    },
  });
}

function resolveExpectedOrigin(request: Request): string {
  const url = new URL(request.url);
  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto');
  if (forwardedHost) {
    const proto = forwardedProto ? forwardedProto.split(',')[0].trim() : url.protocol.replace(':', '');
    return `${proto}://${forwardedHost.split(',')[0].trim()}`;
  }
  return url.origin;
}

function isHttpsRequest(request: Request): boolean {
  const url = new URL(request.url);
  if (url.protocol === 'https:') return true;
  const forwardedProto = request.headers.get('x-forwarded-proto');
  return Boolean(forwardedProto && forwardedProto.split(',')[0].trim() === 'https');
}

function checkOriginForMutation(request: Request): boolean {
  const secFetchSite = request.headers.get('sec-fetch-site');
  if (secFetchSite === 'cross-site') {
    return false;
  }
  const origin = request.headers.get('origin');
  if (!origin) {
    return false;
  }
  const expected = resolveExpectedOrigin(request);
  const urlOrigin = new URL(request.url).origin;
  return origin === expected || origin === urlOrigin;
}

function getClientIp(request: Request): string {
  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp.trim();
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return 'local-client';
}

function parseCookies(header: string | null): Record<string, string> {
  if (!header) return {};
  const result: Record<string, string> = {};
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const k = part.slice(0, eq).trim();
    const v = part.slice(eq + 1).trim();
    if (k) result[k] = decodeURIComponent(v);
  }
  return result;
}

export function resolveExplicitChannel(
  raw: unknown
): { tenantId: 1 | 2; channelPath: '/vagas1' | '/vagas2' } | null {
  if (raw === 1 || raw === '1' || raw === '/vagas1' || raw === 'vagas1') {
    return { tenantId: 1, channelPath: '/vagas1' };
  }
  if (raw === 2 || raw === '2' || raw === '/vagas2' || raw === 'vagas2') {
    return { tenantId: 2, channelPath: '/vagas2' };
  }
  return null;
}

async function checkPersistentRateLimit(
  db: D1Database,
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<boolean> {
  const now = Date.now();
  const row = await db
    .prepare(
      `INSERT INTO rate_limits (key, count, window_start)
       VALUES (?, 1, ?)
       ON CONFLICT(key) DO UPDATE SET
         count = CASE
           WHEN (excluded.window_start - rate_limits.window_start) >= ? THEN 1
           ELSE MIN(rate_limits.count + 1, ?)
         END,
         window_start = CASE
           WHEN (excluded.window_start - rate_limits.window_start) >= ? THEN excluded.window_start
           ELSE rate_limits.window_start
         END
       RETURNING count`
    )
    .bind(key, now, windowMs, maxRequests + 1, windowMs)
    .first<{ count: number }>();

  return Number(row?.count ?? 0) <= maxRequests;
}

function detectFileSignature(
  buffer: Uint8Array,
  originalName: string,
  category: string
): { valid: boolean; mimeType: string; error?: string } {
  if (buffer.length < 8) {
    return { valid: false, mimeType: '', error: 'Arquivo vazio ou corrompido.' };
  }

  // PDF: %PDF-
  if (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46 &&
    buffer[4] === 0x2d
  ) {
    return { valid: true, mimeType: 'application/pdf' };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { valid: true, mimeType: 'image/png' };
  }

  // JPG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { valid: true, mimeType: 'image/jpeg' };
  }

  // DOCX (somente currículo): ZIP PK\x03\x04 + extensão .docx
  const lower = originalName.toLowerCase();
  if (
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04 &&
    lower.endsWith('.docx')
  ) {
    if (category !== 'curriculo') {
      return {
        valid: false,
        mimeType: '',
        error: 'O formato DOCX é permitido somente para o envio de currículo.',
      };
    }
    return {
      valid: true,
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
  }

  return {
    valid: false,
    mimeType: '',
    error:
      'Formato de arquivo não suportado ou assinatura inválida. Envie PDF, JPG, PNG ou DOCX (apenas currículo).',
  };
}

function sanitizeFileName(raw: string): string {
  const base = raw.split(/[/\\]/).pop() || 'documento';
  return base.replace(/[^\w.\-() ]+/g, '_').slice(0, 180) || 'documento';
}

function generateProtocolCode(): string {
  const year = new Date().getFullYear();
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0').toUpperCase();
  }
  return `JSL-${year}-${hex}`;
}

async function authenticateSession(
  request: Request,
  db: D1Database
): Promise<AdminSession | null> {
  const cookies = parseCookies(request.headers.get('cookie'));
  const rawToken = cookies[SESSION_COOKIE_NAME];
  if (!rawToken || rawToken.length < 32) {
    return null;
  }

  const tokenHash = await sha256Hex(rawToken);
  const nowIso = new Date().toISOString();

  const row = await db
    .prepare(
      `SELECT s.user_id, s.tenant_id, s.expires_at, s.revoked_at, u.username, u.display_name, u.active
       FROM sessions s
       INNER JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ?`
    )
    .bind(tokenHash)
    .first<{
      user_id: number;
      tenant_id: number;
      expires_at: string;
      revoked_at: string | null;
      username: string;
      display_name: string;
      active: number;
    }>();

  if (!row || row.revoked_at !== null || row.active !== 1 || row.expires_at <= nowIso) {
    return null;
  }

  if (row.tenant_id !== 1 && row.tenant_id !== 2) {
    return null;
  }

  return {
    userId: row.user_id,
    username: row.username,
    displayName: row.display_name,
    tenantId: row.tenant_id,
    channelPath: row.tenant_id === 1 ? '/vagas1' : '/vagas2',
    tokenHash,
  };
}

function buildSessionCookieHeader(
  request: Request,
  token: string,
  maxAgeSeconds: number
): string {
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/',
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (isHttpsRequest(request)) {
    parts.push('Secure');
  }
  return parts.join('; ');
}

const loginSchema = z.object({
  username: z.string().trim().min(2, 'Informe o usuário.').max(64),
  password: z.string().min(4, 'Informe a senha.').max(128),
});

const submitApplicationSchema = z.object({
  honeypot: z.string().max(0, 'Envio bloqueado por proteção antispam.').optional().default(''),
  channel: z.union([z.literal('/vagas1'), z.literal('/vagas2'), z.literal('vagas1'), z.literal('vagas2'), z.literal(1), z.literal(2), z.literal('1'), z.literal('2')]),
  idempotencyKey: z.string().trim().min(8).max(128).regex(/^[a-zA-Z0-9_\-]+$/),
  jobId: z.string().min(2).max(128),
  jobTitle: z.string().min(2).max(160),
  jobRoleType: z.string().min(2).max(64),
  jobSalaryDisplay: z.string().max(80),
  personal: personalSchema,
  education: educationSchema,
  professionalSummary: z.object({
    hasWorkedBefore: z.enum(['Sim', 'Não, estou buscando meu primeiro emprego']),
    currentlyEmployed: z.enum(['Sim', 'Não', '']).optional().default(''),
    totalLogisticsExperience: z.string().max(100).optional().default(''),
    salaryExpectation: z.string().max(60).optional().default(''),
    startAvailability: z.string().min(1, 'Informe sua disponibilidade para iniciar.').max(120),
  }),
  experiences: z.array(workExperienceSchema).max(20),
  availability: availabilitySchema,
  roleSpecific: z.record(z.string(), z.string().max(400)).default({}),
  safetyAndAccessibility: z.object({
    confirmedEssentialTasks: z.literal(true, {
      message: 'Confirme ciência das atividades essenciais da função.',
    }),
    awareSafetyAndTraining: z.literal(true, {
      message: 'Confirme ciência dos procedimentos de segurança.',
    }),
    needsProcessAccommodation: z.enum(['Não', 'Sim']),
    accommodationDetails: z.string().max(500).optional().default(''),
  }),
  attachments: z
    .array(
      z.object({
        fileId: z.string().regex(/^[a-zA-Z0-9_-]+$/),
        originalName: z.string().min(1).max(255),
        mimeType: z.string().min(1).max(120),
        sizeBytes: z.number().int().positive().max(MAX_FILE_SIZE_BYTES),
        category: z.enum(['curriculo', 'certificado', 'curso', 'qualificacao']),
        sha256: z.string().min(16).max(128),
      })
    )
    .max(6)
    .default([]),
  lgpdConsent: z.literal(true, {
    message: 'É necessário confirmar a ciência da Política de Privacidade.',
  }),
  talentPoolConsent: z.boolean().default(false),
});

const patchApplicationSchema = z.object({
  status: z.enum(APPLICATION_STATUSES as [string, ...string[]]),
  comment: z.string().trim().max(1000).optional().default(''),
  internalNotes: z.string().max(3000).optional().default(''),
});

interface AdminListFilters {
  search: string;
  status: string;
  jobId: string;
  startUtc: string | null;
  endUtc: string | null;
}

function parseAdminFilters(url: URL): { filters?: AdminListFilters; error?: string } {
  const search = (url.searchParams.get('search') || '').trim().slice(0, 120);
  const status = (url.searchParams.get('status') || 'all').trim();
  const jobId = (url.searchParams.get('jobId') || 'all').trim();
  const dateFrom = (url.searchParams.get('dateFrom') || '').trim();
  const dateTo = (url.searchParams.get('dateTo') || '').trim();

  let startUtc: string | null = null;
  let endUtc: string | null = null;

  if (dateFrom) {
    const b = saoPauloDateToUtcBounds(dateFrom);
    if (!b) return { error: 'Data inicial inválida. Use o formato AAAA-MM-DD.' };
    startUtc = b.startUtc;
  }
  if (dateTo) {
    const b = saoPauloDateToUtcBounds(dateTo);
    if (!b) return { error: 'Data final inválida. Use o formato AAAA-MM-DD.' };
    endUtc = b.endUtc;
  }
  if (dateFrom && dateTo && dateFrom > dateTo) {
    return { error: 'A data inicial não pode ser posterior à data final.' };
  }

  return {
    filters: { search, status, jobId, startUtc, endUtc },
  };
}

function buildApplicationsWhereClause(
  tenantId: 1 | 2,
  filters: AdminListFilters
): { sql: string; params: unknown[] } {
  const clauses: string[] = ['tenant_id = ?'];
  const params: unknown[] = [tenantId];

  if (filters.status && filters.status !== 'all') {
    clauses.push('status = ?');
    params.push(filters.status);
  }
  if (filters.jobId && filters.jobId !== 'all') {
    clauses.push('job_id = ?');
    params.push(filters.jobId);
  }
  if (filters.startUtc) {
    clauses.push('created_at >= ?');
    params.push(filters.startUtc);
  }
  if (filters.endUtc) {
    clauses.push('created_at <= ?');
    params.push(filters.endUtc);
  }
  if (filters.search) {
    const pattern = `%${filters.search.toLowerCase()}%`;
    clauses.push(
      '(LOWER(candidate_name) LIKE ? OR LOWER(candidate_email) LIKE ? OR LOWER(candidate_phone) LIKE ? OR LOWER(candidate_whatsapp) LIKE ? OR LOWER(candidate_city) LIKE ? OR LOWER(protocol) LIKE ?)'
    );
    params.push(pattern, pattern, pattern, pattern, pattern, pattern);
  }

  return {
    sql: clauses.join(' AND '),
    params,
  };
}

export async function handleApiRequest(request: Request, env: WorkerEnv): Promise<Response> {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  const pathname = url.pathname;

  if (!env?.DB) {
    return jsonResponse(
      { error: 'Banco de dados D1 (DB) não vinculado ao ambiente.' },
      500
    );
  }

  if (method === 'POST' || method === 'PATCH' || method === 'DELETE') {
    if (!checkOriginForMutation(request)) {
      return jsonResponse(
        { error: 'Origem da requisição inválida ou não autorizada.' },
        403
      );
    }
  }

  const db = env.DB;
  const ip = getClientIp(request);

  // 1. Health check
  if (method === 'GET' && pathname === '/api/health') {
    return jsonResponse({ status: 'ok', runtime: 'cloudflare-pages-d1', timestamp: new Date().toISOString() });
  }

  // 2. Autenticação: Login
  if (method === 'POST' && pathname === '/api/auth/login') {
    const ipAllowed = await checkPersistentRateLimit(db, `login:${ip}`, 8, 15 * 60 * 1000);
    if (!ipAllowed) {
      return jsonResponse(
        { error: 'Muitas tentativas de login. Aguarde alguns minutos antes de tentar novamente.' },
        429
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: 'Corpo da requisição inválido.' }, 400);
    }

    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return jsonResponse(
        { error: parsed.error.issues[0]?.message || 'Credenciais inválidas.' },
        400
      );
    }

    const username = parsed.data.username.toLowerCase();
    const userAllowed = await checkPersistentRateLimit(
      db,
      `login_user:${ip}:${username}`,
      6,
      15 * 60 * 1000
    );
    if (!userAllowed) {
      return jsonResponse(
        { error: 'Muitas tentativas para este usuário. Aguarde alguns minutos.' },
        429
      );
    }

    const user = await db
      .prepare(
        'SELECT id, username, display_name, tenant_id, password_hash, active FROM users WHERE LOWER(username) = ?'
      )
      .bind(username)
      .first<{
        id: number;
        username: string;
        display_name: string;
        tenant_id: number;
        password_hash: string;
        active: number;
      }>();

    const validPassword = user
      ? await verifyPasswordPBKDF2(parsed.data.password, user.password_hash)
      : await verifyPasswordPBKDF2(parsed.data.password, DUMMY_PBKDF2_HASH).then(() => false);

    if (!user || user.active !== 1 || !validPassword || (user.tenant_id !== 1 && user.tenant_id !== 2)) {
      return jsonResponse({ error: 'Usuário ou senha inválidos.' }, 401);
    }

    const rawToken = generateRandomTokenHex(32);
    const tokenHash = await sha256Hex(rawToken);
    const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();

    await db.batch([
      db
        .prepare(
          'INSERT INTO sessions (token_hash, user_id, tenant_id, expires_at) VALUES (?, ?, ?, ?)'
        )
        .bind(tokenHash, user.id, user.tenant_id, expiresAt),
      db
        .prepare(
          'INSERT INTO audit_logs (id, tenant_id, actor_username, action, target_type, target_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        )
        .bind(
          crypto.randomUUID(),
          user.tenant_id,
          user.username,
          'LOGIN_SUCCESS',
          'session',
          String(user.id),
          'Login administrativo realizado com sucesso.',
          new Date().toISOString()
        ),
    ]);

    return jsonResponse(
      {
        user: {
          username: user.username,
          displayName: user.display_name,
          tenantId: user.tenant_id,
          channelPath: user.tenant_id === 1 ? '/vagas1' : '/vagas2',
        },
      },
      200,
      {
        'Set-Cookie': buildSessionCookieHeader(request, rawToken, SESSION_TTL_SECONDS),
      }
    );
  }

  // 3. Autenticação: Logout
  if (method === 'POST' && pathname === '/api/auth/logout') {
    const cookies = parseCookies(request.headers.get('cookie'));
    const rawToken = cookies[SESSION_COOKIE_NAME];
    if (rawToken) {
      const tokenHash = await sha256Hex(rawToken);
      await db
        .prepare('UPDATE sessions SET revoked_at = ? WHERE token_hash = ?')
        .bind(new Date().toISOString(), tokenHash)
        .run();
    }
    return jsonResponse(
      { ok: true },
      200,
      { 'Set-Cookie': buildSessionCookieHeader(request, '', 0) }
    );
  }

  // 4. Sessão atual
  if (method === 'GET' && (pathname === '/api/auth/me' || pathname === '/api/admin/me')) {
    const session = await authenticateSession(request, db);
    if (!session) {
      return jsonResponse({ error: 'Sessão não autenticada ou expirada.' }, 401);
    }
    return jsonResponse({
      user: {
        username: session.username,
        displayName: session.displayName,
        tenantId: session.tenantId,
        channelPath: session.channelPath,
      },
    });
  }

  // 5. Upload público seguro de anexos (em chunks de 192 KB no D1, associado estritamente ao canal explícito)
  if (method === 'POST' && pathname === '/api/uploads') {
    const allowed = await checkPersistentRateLimit(db, `upload:${ip}`, 25, 15 * 60 * 1000);
    if (!allowed) {
      return jsonResponse(
        { error: 'Limite de envios de arquivos atingido. Aguarde alguns minutos.' },
        429
      );
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return jsonResponse({ error: 'Formato multipart/form-data inválido.' }, 400);
    }

    const headerChannel = request.headers.get('x-recruitment-channel');
    const fieldChannel = formData.get('channel');
    const resolvedHeader = headerChannel ? resolveExplicitChannel(headerChannel) : null;
    const resolvedField = fieldChannel ? resolveExplicitChannel(String(fieldChannel)) : null;

    if (headerChannel && !resolvedHeader) {
      return jsonResponse({ error: 'Canal informado no cabeçalho é inválido.' }, 400);
    }
    if (fieldChannel && !resolvedField) {
      return jsonResponse({ error: 'Canal informado no formulário é inválido.' }, 400);
    }
    if (resolvedHeader && resolvedField && resolvedHeader.tenantId !== resolvedField.tenantId) {
      return jsonResponse({ error: 'Conflito de canal na requisição de upload.' }, 400);
    }

    const resolvedChannel = resolvedHeader || resolvedField;
    if (!resolvedChannel) {
      return jsonResponse(
        { error: 'Canal de candidatura obrigatório (/vagas1 ou /vagas2).' },
        400
      );
    }

    const fileEntry = formData.get('file');
    if (!fileEntry || typeof fileEntry === 'string') {
      return jsonResponse({ error: 'Nenhum arquivo enviado.' }, 400);
    }

    const file = fileEntry as File;
    if (file.size <= 0) {
      return jsonResponse({ error: 'Arquivo vazio.' }, 400);
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return jsonResponse({ error: 'Arquivo excede o limite máximo de 5 MB.' }, 400);
    }

    const category = String(formData.get('category') || 'curriculo');
    if (!['curriculo', 'certificado', 'curso', 'qualificacao'].includes(category)) {
      return jsonResponse({ error: 'Categoria de anexo inválida.' }, 400);
    }

    const safeName = sanitizeFileName(file.name || 'documento');
    const bytes = new Uint8Array(await file.arrayBuffer());
    const detection = detectFileSignature(bytes, safeName, category);
    if (!detection.valid) {
      return jsonResponse({ error: detection.error }, 400);
    }

    const fileId = crypto.randomUUID();
    const sha256 = await sha256Hex(bytes);
    const uploadedAt = new Date().toISOString();

    const chunks: string[] = [];
    for (let offset = 0; offset < bytes.length; offset += CHUNK_SIZE_BYTES) {
      const slice = bytes.subarray(offset, offset + CHUNK_SIZE_BYTES);
      chunks.push(uint8ToBase64(slice));
    }

    const statements: D1PreparedStatement[] = [
      db
        .prepare(
          'INSERT INTO attachments (id, tenant_id, application_id, original_name, mime_type, size_bytes, category, sha256, chunk_count, created_at) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?)'
        )
        .bind(
          fileId,
          resolvedChannel.tenantId,
          safeName,
          detection.mimeType,
          file.size,
          category,
          sha256,
          chunks.length,
          uploadedAt
        ),
    ];

    chunks.forEach((b64, index) => {
      statements.push(
        db
          .prepare(
            'INSERT INTO attachment_chunks (attachment_id, chunk_index, data_base64) VALUES (?, ?, ?)'
          )
          .bind(fileId, index, b64)
      );
    });

    await db.batch(statements);

    return jsonResponse(
      {
        fileId,
        originalName: safeName,
        mimeType: detection.mimeType,
        sizeBytes: file.size,
        category,
        sha256,
        uploadedAt,
      },
      201
    );
  }

  // 6. Submissão pública de candidatura (idempotente, canal obrigatório, vínculo atômico de anexos)
  if (method === 'POST' && pathname === '/api/applications') {
    const allowed = await checkPersistentRateLimit(db, `submit:${ip}`, 10, 15 * 60 * 1000);
    if (!allowed) {
      return jsonResponse(
        { error: 'Muitas tentativas em sequência. Aguarde alguns minutos.' },
        429
      );
    }

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return jsonResponse({ error: 'JSON inválido.' }, 400);
    }

    const parsed = submitApplicationSchema.safeParse(rawBody);
    if (!parsed.success) {
      return jsonResponse(
        {
          error: parsed.error.issues[0]?.message || 'Dados inválidos no formulário de candidatura.',
          issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        },
        400
      );
    }

    const data = parsed.data;
    const channelFromBody = resolveExplicitChannel(data.channel);
    const headerChannelRaw = request.headers.get('x-recruitment-channel');
    const channelFromHeader = headerChannelRaw ? resolveExplicitChannel(headerChannelRaw) : null;

    if (!channelFromBody) {
      return jsonResponse(
        { error: 'Canal de inscrição obrigatório (/vagas1 ou /vagas2).' },
        400
      );
    }
    if (headerChannelRaw && (!channelFromHeader || channelFromHeader.tenantId !== channelFromBody.tenantId)) {
      return jsonResponse({ error: 'Conflito de canal na inscrição.' }, 400);
    }

    // Verifica idempotência antes de gravar novamente
    const existing = await db
      .prepare(
        'SELECT id, protocol, created_at, candidate_name, job_title, channel_path FROM applications WHERE tenant_id = ? AND idempotency_key = ?'
      )
      .bind(channelFromBody.tenantId, data.idempotencyKey)
      .first<{
        id: string;
        protocol: string;
        created_at: string;
        candidate_name: string;
        job_title: string;
        channel_path: string;
      }>();

    if (existing) {
      return jsonResponse(
        {
          applicationId: existing.id,
          protocol: existing.protocol,
          submittedAt: existing.created_at,
          candidateName: existing.candidate_name,
          jobTitle: existing.job_title,
          channelPath: existing.channel_path,
        },
        200
      );
    }

    if (data.professionalSummary.hasWorkedBefore === 'Sim' && data.experiences.length === 0) {
      return jsonResponse(
        { error: 'Adicione ao menos uma experiência profissional ou selecione primeiro emprego.' },
        400
      );
    }

    const normalizedExperiences = [];
    for (const exp of data.experiences) {
      const duration = calculateWorkDuration(exp.startDate, exp.endDate || '', exp.isCurrent);
      if (!duration.valid) {
        return jsonResponse(
          { error: `Experiência em "${exp.companyName}": ${duration.label}` },
          400
        );
      }
      normalizedExperiences.push({
        ...exp,
        calculatedYears: duration.years,
        calculatedMonths: duration.months,
        durationLabel: duration.label,
      });
    }

    // Verifica integridade dos anexos: devem existir, pertencer ao mesmo tenant e ainda não estar vinculados
    const seenAttachmentIds = new Set<string>();
    for (const att of data.attachments) {
      if (seenAttachmentIds.has(att.fileId)) {
        return jsonResponse({ error: 'Anexo duplicado na solicitação.' }, 400);
      }
      seenAttachmentIds.add(att.fileId);

      const attRow = await db
        .prepare('SELECT id, tenant_id, application_id FROM attachments WHERE id = ?')
        .bind(att.fileId)
        .first<{ id: string; tenant_id: number; application_id: string | null }>();

      if (!attRow || attRow.tenant_id !== channelFromBody.tenantId) {
        return jsonResponse(
          { error: 'Anexo inválido ou não autorizado para este canal.' },
          403
        );
      }
      if (attRow.application_id !== null) {
        return jsonResponse(
          { error: 'Um dos anexos já foi vinculado a outra candidatura.' },
          409
        );
      }
    }

    const applicationId = crypto.randomUUID();
    const protocol = generateProtocolCode();
    const nowIso = new Date().toISOString();

    const payloadJson = JSON.stringify({
      personal: data.personal,
      education: data.education,
      professionalSummary: data.professionalSummary,
      availability: data.availability,
      roleSpecific: data.roleSpecific,
      safetyAndAccessibility: data.safetyAndAccessibility,
      lgpdConsent: true,
      talentPoolConsent: Boolean(data.talentPoolConsent),
    });

    const batchStatements: D1PreparedStatement[] = [
      db
        .prepare(
          `INSERT INTO applications (
            id, tenant_id, channel_path, protocol, idempotency_key,
            job_id, job_title, job_role_type, job_salary_display,
            status, candidate_name, candidate_email, candidate_phone,
            candidate_whatsapp, candidate_city, candidate_state,
            payload_json, internal_notes, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Recebida', ?, ?, ?, ?, ?, ?, ?, '', ?, ?)`
        )
        .bind(
          applicationId,
          channelFromBody.tenantId,
          channelFromBody.channelPath,
          protocol,
          data.idempotencyKey,
          data.jobId,
          data.jobTitle,
          data.jobRoleType,
          data.jobSalaryDisplay,
          data.personal.fullName,
          data.personal.email,
          data.personal.phone,
          data.personal.whatsapp || '',
          data.personal.city,
          data.personal.state,
          payloadJson,
          nowIso,
          nowIso
        ),
      db
        .prepare(
          'INSERT INTO status_history (id, application_id, tenant_id, from_status, to_status, comment, changed_by_username, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        )
        .bind(
          crypto.randomUUID(),
          applicationId,
          channelFromBody.tenantId,
          '',
          'Recebida',
          'Candidatura registrada pelo portal.',
          'sistema',
          nowIso
        ),
    ];

    for (const exp of normalizedExperiences) {
      batchStatements.push(
        db
          .prepare(
            `INSERT INTO application_experiences (
              id, application_id, tenant_id, company_name, role, start_date, end_date, is_current, duration_label, payload_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            crypto.randomUUID(),
            applicationId,
            channelFromBody.tenantId,
            exp.companyName,
            exp.role,
            exp.startDate,
            exp.isCurrent ? '' : exp.endDate || '',
            exp.isCurrent ? 1 : 0,
            exp.durationLabel,
            JSON.stringify(exp)
          )
      );
    }

    for (const att of data.attachments) {
      batchStatements.push(
        db
          .prepare('UPDATE attachments SET application_id = ? WHERE id = ?')
          .bind(applicationId, att.fileId)
      );
    }

    const attachmentStartIdx = batchStatements.length - data.attachments.length;

    try {
      const batchResults = await db.batch(batchStatements);
      for (let i = attachmentStartIdx; i < batchResults.length; i++) {
        if ((batchResults[i]?.meta?.changes ?? 0) !== 1) {
          await db.prepare('DELETE FROM applications WHERE id = ?').bind(applicationId).run();
          return jsonResponse(
            { error: 'Anexo não localizado para vinculação à candidatura.' },
            409
          );
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('ATTACHMENT_ALREADY_BOUND')) {
        return jsonResponse(
          { error: 'Um dos anexos já foi vinculado a outra candidatura.' },
          409
        );
      }
      if (msg.includes('ATTACHMENT_TENANT_MISMATCH')) {
        return jsonResponse(
          { error: 'Anexo inválido ou não autorizado para este canal.' },
          403
        );
      }
      if (msg.includes('UNIQUE constraint failed')) {
        const existingOnRace = await db
          .prepare(
            'SELECT id, protocol, created_at, candidate_name, job_title, channel_path FROM applications WHERE tenant_id = ? AND idempotency_key = ?'
          )
          .bind(channelFromBody.tenantId, data.idempotencyKey)
          .first<{
            id: string;
            protocol: string;
            created_at: string;
            candidate_name: string;
            job_title: string;
            channel_path: string;
          }>();
        if (existingOnRace) {
          return jsonResponse(
            {
              applicationId: existingOnRace.id,
              protocol: existingOnRace.protocol,
              submittedAt: existingOnRace.created_at,
              candidateName: existingOnRace.candidate_name,
              jobTitle: existingOnRace.job_title,
              channelPath: existingOnRace.channel_path,
            },
            200
          );
        }
      }
      throw err;
    }

    return jsonResponse(
      {
        applicationId,
        protocol,
        submittedAt: nowIso,
        candidateName: data.personal.fullName,
        jobTitle: data.jobTitle,
        channelPath: channelFromBody.channelPath,
      },
      201
    );
  }

  // 7. Mensagem pública de contato
  if (method === 'POST' && pathname === '/api/contact') {
    const allowed = await checkPersistentRateLimit(db, `contact:${ip}`, 10, 15 * 60 * 1000);
    if (!allowed) {
      return jsonResponse({ error: 'Limite de mensagens atingido. Aguarde alguns minutos.' }, 429);
    }
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: 'JSON inválido.' }, 400);
    }

    const parsed = contactMessageSchema.safeParse((body || {}) as Record<string, unknown>);
    if (!parsed.success) {
      return jsonResponse(
        { error: parsed.error.issues[0]?.message || 'Verifique os campos preenchidos.' },
        400
      );
    }

    const rawChannel = (body as Record<string, unknown>)?.channel;
    const resolvedChannel = rawChannel ? resolveExplicitChannel(rawChannel) : null;
    if (rawChannel && !resolvedChannel) {
      return jsonResponse({ error: 'Canal inválido.' }, 400);
    }

    const nowIso = new Date().toISOString();
    await db
      .prepare(
        'INSERT INTO contact_messages (id, tenant_id, name, email, phone, subject, message, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .bind(
        crypto.randomUUID(),
        resolvedChannel ? resolvedChannel.tenantId : null,
        parsed.data.name,
        parsed.data.email,
        parsed.data.phone || '',
        parsed.data.subject,
        parsed.data.message,
        nowIso
      )
      .run();

    return jsonResponse({ ok: true }, 201);
  }

  // ======== ROTAS ADMINISTRATIVAS PRIVADAS (ISOLAMENTO ESTRITO POR TENANT) ========
  if (pathname.startsWith('/api/admin/')) {
    const session = await authenticateSession(request, db);
    if (!session) {
      return jsonResponse({ error: 'Sessão não autenticada ou expirada.' }, 401);
    }

    // 8. Listagem paginada e métricas do próprio tenant
    if (method === 'GET' && pathname === '/api/admin/applications') {
      const { filters, error } = parseAdminFilters(url);
      if (error || !filters) {
        return jsonResponse({ error: error || 'Filtros inválidos.' }, 400);
      }

      const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
      const pageSize = Math.min(50, Math.max(1, parseInt(url.searchParams.get('pageSize') || '15', 10) || 15));
      const offset = (page - 1) * pageSize;

      const { sql: whereSql, params: whereParams } = buildApplicationsWhereClause(
        session.tenantId,
        filters
      );

      const countRow = await db
        .prepare(`SELECT COUNT(*) AS total FROM applications WHERE ${whereSql}`)
        .bind(...whereParams)
        .first<{ total: number }>();
      const total = Number(countRow?.total || 0);

      const rowsRes = await db
        .prepare(
          `SELECT id, protocol, job_id, job_title, job_salary_display, status,
                  candidate_name, candidate_email, candidate_phone, candidate_whatsapp,
                  candidate_city, candidate_state, created_at, updated_at
           FROM applications
           WHERE ${whereSql}
           ORDER BY created_at DESC
           LIMIT ? OFFSET ?`
        )
        .bind(...whereParams, pageSize, offset)
        .all<{
          id: string;
          protocol: string;
          job_id: string;
          job_title: string;
          job_salary_display: string;
          status: string;
          candidate_name: string;
          candidate_email: string;
          candidate_phone: string;
          candidate_whatsapp: string;
          candidate_city: string;
          candidate_state: string;
          created_at: string;
          updated_at: string;
        }>();

      const statsRows = await db
        .prepare('SELECT status, COUNT(*) AS cnt FROM applications WHERE tenant_id = ? GROUP BY status')
        .bind(session.tenantId)
        .all<{ status: string; cnt: number }>();

      let totalAll = 0;
      let novas = 0;
      let emAcompanhamento = 0;
      let finalizadas = 0;

      for (const r of statsRows.results || []) {
        const c = Number(r.cnt || 0);
        totalAll += c;
        if (r.status === 'Recebida') {
          novas += c;
        } else if (r.status === 'Processo finalizado') {
          finalizadas += c;
        } else {
          emAcompanhamento += c;
        }
      }

      return jsonResponse({
        items: (rowsRes.results || []).map((r) => ({
          id: r.id,
          protocol: r.protocol,
          jobId: r.job_id,
          jobTitle: r.job_title,
          jobSalaryDisplay: r.job_salary_display,
          status: r.status,
          candidateName: r.candidate_name,
          candidateEmail: r.candidate_email,
          candidatePhone: r.candidate_phone,
          candidateWhatsapp: r.candidate_whatsapp,
          candidateCity: r.candidate_city,
          candidateState: r.candidate_state,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        })),
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
        stats: {
          total: totalAll,
          novas,
          emAcompanhamento,
          finalizadas,
        },
      });
    }

    // 9. Exportação CSV estritamente do tenant autenticado (escopo página ou filtro completo)
    if (method === 'GET' && pathname === '/api/admin/export') {
      const { filters, error } = parseAdminFilters(url);
      if (error || !filters) {
        return jsonResponse({ error: error || 'Filtros inválidos.' }, 400);
      }
      const scope = url.searchParams.get('scope') === 'page' ? 'page' : 'filtered';
      const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
      const pageSize = Math.min(50, Math.max(1, parseInt(url.searchParams.get('pageSize') || '15', 10) || 15));
      const offset = (page - 1) * pageSize;

      const { sql: whereSql, params: whereParams } = buildApplicationsWhereClause(
        session.tenantId,
        filters
      );

      const querySql =
        scope === 'page'
          ? `SELECT protocol, candidate_name, candidate_email, candidate_phone, candidate_whatsapp, candidate_city, candidate_state, job_title, job_salary_display, status, payload_json, created_at
             FROM applications WHERE ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`
          : `SELECT protocol, candidate_name, candidate_email, candidate_phone, candidate_whatsapp, candidate_city, candidate_state, job_title, job_salary_display, status, payload_json, created_at
             FROM applications WHERE ${whereSql} ORDER BY created_at DESC LIMIT 5000`;

      const bindParams = scope === 'page' ? [...whereParams, pageSize, offset] : whereParams;

      const res = await db
        .prepare(querySql)
        .bind(...bindParams)
        .all<{
          protocol: string;
          candidate_name: string;
          candidate_email: string;
          candidate_phone: string;
          candidate_whatsapp: string;
          candidate_city: string;
          candidate_state: string;
          job_title: string;
          job_salary_display: string;
          status: string;
          payload_json: string;
          created_at: string;
        }>();

      const headers = [
        'Protocolo',
        'Candidato',
        'E-mail',
        'Telefone',
        'WhatsApp',
        'Cidade',
        'UF',
        'Vaga',
        'Salário Anunciado',
        'Status',
        'Escolaridade',
        'Viagens',
        'Pernoite',
        'Início',
        'Data Recebimento (UTC)',
      ];

      const csvLines = [headers.map(escapeCsvCell).join(';')];
      for (const r of res.results || []) {
        let payload: {
          education?: { educationLevel?: string };
          availability?: {
            travelAvailability?: string;
            overnightStayAvailability?: string;
            startTimeline?: string;
          };
        } = {};
        try {
          payload = JSON.parse(r.payload_json);
        } catch {
          payload = {};
        }

        csvLines.push(
          [
            r.protocol,
            r.candidate_name,
            r.candidate_email,
            r.candidate_phone,
            r.candidate_whatsapp,
            r.candidate_city,
            r.candidate_state,
            r.job_title,
            r.job_salary_display,
            r.status,
            payload.education?.educationLevel || '',
            payload.availability?.travelAvailability || '',
            payload.availability?.overnightStayAvailability || '',
            payload.availability?.startTimeline || '',
            r.created_at,
          ]
            .map(escapeCsvCell)
            .join(';')
        );
      }

      await db
        .prepare(
          'INSERT INTO audit_logs (id, tenant_id, actor_username, action, target_type, target_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        )
        .bind(
          crypto.randomUUID(),
          session.tenantId,
          session.username,
          'EXPORT_CSV',
          'applications',
          scope,
          `Exportação CSV (${scope}) de ${(res.results || []).length} candidatura(s).`,
          new Date().toISOString()
        )
        .run();

      const csvBody = '\uFEFF' + csvLines.join('\n');
      return new Response(csvBody, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="candidaturas-${session.channelPath.slice(1)}-${scope}.csv"`,
          'X-Content-Type-Options': 'nosniff',
          'Cache-Control': 'no-store',
        },
      });
    }

    // 10. Detalhes completos da candidatura do próprio tenant
    const detailMatch = pathname.match(/^\/api\/admin\/applications\/([a-zA-Z0-9_-]+)$/);
    if (method === 'GET' && detailMatch) {
      const appId = detailMatch[1];
      const appRow = await db
        .prepare('SELECT * FROM applications WHERE id = ? AND tenant_id = ?')
        .bind(appId, session.tenantId)
        .first<{
          id: string;
          tenant_id: number;
          channel_path: string;
          protocol: string;
          job_id: string;
          job_title: string;
          job_role_type: string;
          job_salary_display: string;
          status: string;
          candidate_name: string;
          candidate_email: string;
          candidate_phone: string;
          candidate_whatsapp: string;
          candidate_city: string;
          candidate_state: string;
          payload_json: string;
          internal_notes: string;
          created_at: string;
          updated_at: string;
        }>();

      if (!appRow) {
        return jsonResponse({ error: 'Candidatura não encontrada.' }, 404);
      }

      const [expRes, attRes, histRes] = await Promise.all([
        db
          .prepare(
            'SELECT id, company_name, role, start_date, end_date, is_current, duration_label, payload_json FROM application_experiences WHERE application_id = ? AND tenant_id = ?'
          )
          .bind(appId, session.tenantId)
          .all<{
            id: string;
            company_name: string;
            role: string;
            start_date: string;
            end_date: string;
            is_current: number;
            duration_label: string;
            payload_json: string;
          }>(),
        db
          .prepare(
            'SELECT id, original_name, mime_type, size_bytes, category, sha256, created_at FROM attachments WHERE application_id = ? AND tenant_id = ? ORDER BY created_at ASC'
          )
          .bind(appId, session.tenantId)
          .all<{
            id: string;
            original_name: string;
            mime_type: string;
            size_bytes: number;
            category: string;
            sha256: string;
            created_at: string;
          }>(),
        db
          .prepare(
            'SELECT id, from_status, to_status, comment, changed_by_username, created_at FROM status_history WHERE application_id = ? AND tenant_id = ? ORDER BY created_at DESC'
          )
          .bind(appId, session.tenantId)
          .all<{
            id: string;
            from_status: string;
            to_status: string;
            comment: string;
            changed_by_username: string;
            created_at: string;
          }>(),
      ]);

      return jsonResponse({
        application: {
          id: appRow.id,
          protocol: appRow.protocol,
          channelPath: appRow.channel_path,
          jobId: appRow.job_id,
          jobTitle: appRow.job_title,
          jobRoleType: appRow.job_role_type,
          jobSalaryDisplay: appRow.job_salary_display,
          status: appRow.status,
          internalNotes: appRow.internal_notes,
          createdAt: appRow.created_at,
          updatedAt: appRow.updated_at,
          ...JSON.parse(appRow.payload_json),
        },
        experiences: (expRes.results || []).map((e) => JSON.parse(e.payload_json)),
        attachments: (attRes.results || []).map((a) => ({
          fileId: a.id,
          originalName: a.original_name,
          mimeType: a.mime_type,
          sizeBytes: a.size_bytes,
          category: a.category,
          sha256: a.sha256,
          createdAt: a.created_at,
        })),
        history: (histRes.results || []).map((h) => ({
          id: h.id,
          fromStatus: h.from_status,
          toStatus: h.to_status,
          comment: h.comment,
          changedBy: h.changed_by_username,
          createdAt: h.created_at,
        })),
      });
    }

    // 11. Alteração de status e notas internas (restrito ao próprio tenant)
    if (method === 'PATCH' && detailMatch) {
      const appId = detailMatch[1];
      let rawBody: unknown;
      try {
        rawBody = await request.json();
      } catch {
        return jsonResponse({ error: 'JSON inválido.' }, 400);
      }

      const parsed = patchApplicationSchema.safeParse(rawBody);
      if (!parsed.success) {
        return jsonResponse(
          { error: parsed.error.issues[0]?.message || 'Dados inválidos.' },
          400
        );
      }

      const existing = await db
        .prepare('SELECT id, status, protocol FROM applications WHERE id = ? AND tenant_id = ?')
        .bind(appId, session.tenantId)
        .first<{ id: string; status: string; protocol: string }>();

      if (!existing) {
        return jsonResponse({ error: 'Candidatura não encontrada.' }, 404);
      }

      const nowIso = new Date().toISOString();
      await db.batch([
        db
          .prepare(
            'UPDATE applications SET status = ?, internal_notes = ?, updated_at = ? WHERE id = ? AND tenant_id = ?'
          )
          .bind(
            parsed.data.status,
            parsed.data.internalNotes,
            nowIso,
            appId,
            session.tenantId
          ),
        db
          .prepare(
            'INSERT INTO status_history (id, application_id, tenant_id, from_status, to_status, comment, changed_by_username, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
          )
          .bind(
            crypto.randomUUID(),
            appId,
            session.tenantId,
            existing.status,
            parsed.data.status,
            parsed.data.comment || 'Atualização registrada no painel administrativo.',
            session.username,
            nowIso
          ),
        db
          .prepare(
            'INSERT INTO audit_logs (id, tenant_id, actor_username, action, target_type, target_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
          )
          .bind(
            crypto.randomUUID(),
            session.tenantId,
            session.username,
            'UPDATE_STATUS',
            'application',
            appId,
            `Protocolo ${existing.protocol}: ${existing.status} -> ${parsed.data.status}.`,
            nowIso
          ),
      ]);

      return jsonResponse({ ok: true, status: parsed.data.status, updatedAt: nowIso });
    }

    // 12. Download de anexo privado (verifica vínculo com candidatura do próprio tenant)
    const attMatch = pathname.match(/^\/api\/admin\/attachments\/([a-zA-Z0-9_-]+)$/);
    if (method === 'GET' && attMatch) {
      const attId = attMatch[1];
      const attMeta = await db
        .prepare(
          `SELECT att.id, att.original_name, att.mime_type, att.size_bytes
           FROM attachments att
           INNER JOIN applications app ON app.id = att.application_id
           WHERE att.id = ? AND att.tenant_id = ? AND app.tenant_id = ?`
        )
        .bind(attId, session.tenantId, session.tenantId)
        .first<{
          id: string;
          original_name: string;
          mime_type: string;
          size_bytes: number;
        }>();

      if (!attMeta) {
        return jsonResponse({ error: 'Anexo não encontrado.' }, 404);
      }

      const chunksRes = await db
        .prepare(
          'SELECT data_base64 FROM attachment_chunks WHERE attachment_id = ? ORDER BY chunk_index ASC'
        )
        .bind(attId)
        .all<{ data_base64: string }>();

      const decodedParts = (chunksRes.results || []).map((c) => base64ToUint8(c.data_base64));
      const totalLength = decodedParts.reduce((acc, part) => acc + part.length, 0);
      const fullBytes = new Uint8Array(totalLength);
      let cursor = 0;
      for (const part of decodedParts) {
        fullBytes.set(part, cursor);
        cursor += part.length;
      }

      await db
        .prepare(
          'INSERT INTO audit_logs (id, tenant_id, actor_username, action, target_type, target_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        )
        .bind(
          crypto.randomUUID(),
          session.tenantId,
          session.username,
          'DOWNLOAD_ATTACHMENT',
          'attachment',
          attId,
          `Download de "${attMeta.original_name}".`,
          new Date().toISOString()
        )
        .run();

      return new Response(fullBytes, {
        status: 200,
        headers: {
          'Content-Type': attMeta.mime_type || 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(attMeta.original_name)}"`,
          'X-Content-Type-Options': 'nosniff',
          'Cache-Control': 'no-store',
        },
      });
    }
  }

  return jsonResponse({ error: 'Rota API não encontrada.' }, 404);
}
