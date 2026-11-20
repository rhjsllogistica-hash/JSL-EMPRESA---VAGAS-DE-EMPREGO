import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { handleApiRequest } from '../src/server/apiHandler.ts';
import { hashPasswordPBKDF2, sha256Hex } from '../src/server/cryptoUtils.ts';
import { LocalSqliteD1Adapter } from '../src/server/localD1Adapter.ts';

const ORIGIN = 'https://jsl-logistica-vagasdeemprego.pages.dev';
const MIGRATIONS_DIR = path.resolve(process.cwd(), 'migrations');
const ALL_MIGRATIONS = fs
  .readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .map((f) => fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8'));

async function setupTestDb() {
  const db = new LocalSqliteD1Adapter(':memory:');
  for (const sql of ALL_MIGRATIONS) {
    db.applyMigration(sql);
  }

  // Senhas sintéticas exclusivas de teste (nunca senhas reais de produção)
  const hash1 = await hashPasswordPBKDF2('test_pass_tenant1');
  const hash2 = await hashPasswordPBKDF2('test_pass_tenant2');

  await db
    .prepare(
      'INSERT INTO users (username, display_name, tenant_id, password_hash, active) VALUES (?, ?, ?, ?, 1)'
    )
    .bind('recruiter1', 'Recrutador Canal 1', 1, hash1)
    .run();

  await db
    .prepare(
      'INSERT INTO users (username, display_name, tenant_id, password_hash, active) VALUES (?, ?, ?, ?, 1)'
    )
    .bind('recruiter2', 'Recrutador Canal 2', 2, hash2)
    .run();

  return db;
}

function makePdfBytes(extraSize = 0): Uint8Array<ArrayBuffer> {
  const header = new TextEncoder().encode('%PDF-1.4\n%TestPDF\n');
  const buf = new ArrayBuffer(header.length + extraSize);
  const out = new Uint8Array(buf);
  out.set(header, 0);
  for (let i = header.length; i < out.length; i++) {
    out[i] = 65 + (i % 26);
  }
  return out;
}

function buildValidApplicationPayload(overrides: Record<string, unknown> = {}) {
  return {
    honeypot: '',
    channel: '/vagas1',
    idempotencyKey: `idem_${crypto.randomUUID().replace(/-/g, '')}`,
    jobId: 'motorista-caminhao',
    jobTitle: 'Motorista de Caminhão',
    jobRoleType: 'motorista',
    jobSalaryDisplay: 'R$ 8.280,00 mensais',
    personal: {
      fullName: 'Carlos Eduardo Teste',
      phone: '(11) 98765-4321',
      whatsapp: '(11) 98765-4321',
      email: 'carlos.teste@example.com',
      cep: '03105-000',
      city: 'São Paulo',
      state: 'SP',
      neighborhood: 'Mooca',
      deferFullAddress: true,
    },
    education: {
      educationLevel: 'Ensino médio completo',
      hasVocationalCourse: 'Sim',
      vocationalCourseName: 'Direção Defensiva',
      hasCourseCertificate: 'Sim',
      hasLogisticsExperience: 'Sim',
      performedActivitiesText: 'Transporte rodoviário de cargas.',
      skills: ['Transporte rodoviário'],
    },
    professionalSummary: {
      hasWorkedBefore: 'Não, estou buscando meu primeiro emprego',
      currentlyEmployed: '',
      totalLogisticsExperience: 'Menos de 1 ano',
      salaryExpectation: 'R$ 8.280,00',
      startAvailability: 'Imediata',
    },
    experiences: [],
    availability: {
      flexibleHours: 'Sim',
      shiftWork: 'Sim',
      weekendsPerSchedule: 'Sim',
      jobScheduleFit: 'Sim',
      travelAvailability: 'Sim',
      overnightStayAvailability: 'Sim',
      trainingAvailability: 'Sim',
      startTimeline: 'Imediato',
      hasOwnTransport: 'Sim',
      scheduleLimitations: '',
    },
    roleSpecific: {
      cnhCategory: 'Categoria E',
    },
    safetyAndAccessibility: {
      confirmedEssentialTasks: true,
      awareSafetyAndTraining: true,
      needsProcessAccommodation: 'Não',
      accommodationDetails: '',
    },
    attachments: [],
    lgpdConsent: true,
    talentPoolConsent: false,
    ...overrides,
  };
}

function extractSessionCookie(res: Response): string {
  const raw = res.headers.get('set-cookie') || '';
  const match = raw.match(/jsl_session=([^;]+)/);
  assert.ok(match, 'Cookie jsl_session deveria estar presente no Set-Cookie');
  return `jsl_session=${match[1]}`;
}

async function loginAs(
  db: LocalSqliteD1Adapter,
  username: string,
  password: string,
  ip = '198.51.100.10'
): Promise<string> {
  const req = new Request(`${ORIGIN}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: ORIGIN,
      'CF-Connecting-IP': ip,
    },
    body: JSON.stringify({ username, password }),
  });
  const res = await handleApiRequest(req, { DB: db });
  assert.equal(res.status, 200, `Login de ${username} deveria retornar 200`);
  return extractSessionCookie(res);
}

test('Origin/CSRF protection blocks POST/PATCH without or with mismatched Origin', async () => {
  const db = await setupTestDb();

  const missingOrigin = await handleApiRequest(
    new Request(`${ORIGIN}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'recruiter1', password: 'test_pass_tenant1' }),
    }),
    { DB: db }
  );
  assert.equal(missingOrigin.status, 403);

  const foreignOrigin = await handleApiRequest(
    new Request(`${ORIGIN}/api/applications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://evil.example',
      },
      body: JSON.stringify(buildValidApplicationPayload()),
    }),
    { DB: db }
  );
  assert.equal(foreignOrigin.status, 403);
});

test('Authentication creates HttpOnly session hash, validates /me, and logout revokes session', async () => {
  const db = await setupTestDb();

  // Sem cookie -> 401
  const unauthMe = await handleApiRequest(new Request(`${ORIGIN}/api/auth/me`), { DB: db });
  assert.equal(unauthMe.status, 401);

  // Senha inválida -> 401
  const badLogin = await handleApiRequest(
    new Request(`${ORIGIN}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: ORIGIN,
        'CF-Connecting-IP': '203.0.113.1',
      },
      body: JSON.stringify({ username: 'recruiter1', password: 'wrong_password' }),
    }),
    { DB: db }
  );
  assert.equal(badLogin.status, 401);

  // Login válido
  const loginRes = await handleApiRequest(
    new Request(`${ORIGIN}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: ORIGIN,
        'CF-Connecting-IP': '203.0.113.2',
      },
      body: JSON.stringify({ username: 'recruiter1', password: 'test_pass_tenant1' }),
    }),
    { DB: db }
  );
  assert.equal(loginRes.status, 200);
  const setCookie = loginRes.headers.get('set-cookie') || '';
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Lax/i);
  assert.match(setCookie, /Secure/i);

  const cookie = extractSessionCookie(loginRes);
  const rawToken = decodeURIComponent(cookie.split('=')[1]);
  const expectedHash = await sha256Hex(rawToken);
  const storedSession = await db
    .prepare('SELECT token_hash, tenant_id, revoked_at FROM sessions WHERE token_hash = ?')
    .bind(expectedHash)
    .first<{ token_hash: string; tenant_id: number; revoked_at: string | null }>();
  assert.ok(storedSession, 'Apenas o hash SHA-256 da sessão deve estar gravado no D1');
  assert.equal(storedSession.tenant_id, 1);
  assert.equal(storedSession.revoked_at, null);

  // /me autenticado
  const meRes = await handleApiRequest(
    new Request(`${ORIGIN}/api/auth/me`, { headers: { Cookie: cookie } }),
    { DB: db }
  );
  assert.equal(meRes.status, 200);
  const meData = (await meRes.json()) as { user: { username: string; tenantId: number; channelPath: string } };
  assert.equal(meData.user.username, 'recruiter1');
  assert.equal(meData.user.tenantId, 1);
  assert.equal(meData.user.channelPath, '/vagas1');

  // Logout revoga sessão no banco
  const logoutRes = await handleApiRequest(
    new Request(`${ORIGIN}/api/auth/logout`, {
      method: 'POST',
      headers: { Origin: ORIGIN, Cookie: cookie },
    }),
    { DB: db }
  );
  assert.equal(logoutRes.status, 200);

  const meAfterLogout = await handleApiRequest(
    new Request(`${ORIGIN}/api/auth/me`, { headers: { Cookie: cookie } }),
    { DB: db }
  );
  assert.equal(meAfterLogout.status, 401);
});

test('Persistent D1 rate limit blocks excessive failed logins', async () => {
  const db = await setupTestDb();
  for (let i = 0; i < 6; i++) {
    const res = await handleApiRequest(
      new Request(`${ORIGIN}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: ORIGIN,
          'CF-Connecting-IP': '192.0.2.77',
        },
        body: JSON.stringify({ username: 'recruiter1', password: 'wrong_password' }),
      }),
      { DB: db }
    );
    assert.equal(res.status, 401);
  }
  const blocked = await handleApiRequest(
    new Request(`${ORIGIN}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: ORIGIN,
        'CF-Connecting-IP': '192.0.2.77',
      },
      body: JSON.stringify({ username: 'recruiter1', password: 'test_pass_tenant1' }),
    }),
    { DB: db }
  );
  assert.equal(blocked.status, 429);
});

test('Public submissions require explicit channel (/vagas1 or /vagas2) and are idempotent', async () => {
  const db = await setupTestDb();

  // Sem canal explícito -> 400 e ZERO registros criados
  const noChannelRes = await handleApiRequest(
    new Request(`${ORIGIN}/api/applications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
      body: JSON.stringify(buildValidApplicationPayload({ channel: '' })),
    }),
    { DB: db }
  );
  assert.equal(noChannelRes.status, 400);

  const countAfterFail = await db
    .prepare('SELECT COUNT(*) AS total FROM applications')
    .first<{ total: number }>();
  assert.equal(countAfterFail?.total, 0);

  // Conflito header x body -> 400
  const conflictRes = await handleApiRequest(
    new Request(`${ORIGIN}/api/applications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: ORIGIN,
        'X-Recruitment-Channel': '/vagas2',
      },
      body: JSON.stringify(buildValidApplicationPayload({ channel: '/vagas1' })),
    }),
    { DB: db }
  );
  assert.equal(conflictRes.status, 400);

  // Retry com mesma idempotencyKey retorna mesmo protocolo sem duplicar
  const idemKey = 'idem_retry_0001_test';
  const payload = buildValidApplicationPayload({ channel: '/vagas1', idempotencyKey: idemKey });

  const first = await handleApiRequest(
    new Request(`${ORIGIN}/api/applications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: ORIGIN,
        'X-Recruitment-Channel': '/vagas1',
      },
      body: JSON.stringify(payload),
    }),
    { DB: db }
  );
  assert.equal(first.status, 201);
  const firstData = (await first.json()) as { applicationId: string; protocol: string };

  const retry = await handleApiRequest(
    new Request(`${ORIGIN}/api/applications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: ORIGIN,
        'X-Recruitment-Channel': '/vagas1',
      },
      body: JSON.stringify(payload),
    }),
    { DB: db }
  );
  assert.equal(retry.status, 200);
  const retryData = (await retry.json()) as { applicationId: string; protocol: string };
  assert.equal(retryData.applicationId, firstData.applicationId);
  assert.equal(retryData.protocol, firstData.protocol);

  const totalCount = await db
    .prepare('SELECT COUNT(*) AS total FROM applications')
    .first<{ total: number }>();
  assert.equal(totalCount?.total, 1);
});

test('Chunked upload validates magic bytes, size, channel binding, and reassembles binary intact', async () => {
  const db = await setupTestDb();

  // Arquivo com assinatura inválida (executável falso) -> 400
  const badForm = new FormData();
  badForm.append('channel', '/vagas1');
  badForm.append('category', 'curriculo');
  badForm.append('file', new File([new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00])], 'virus.pdf'));
  const badUpload = await handleApiRequest(
    new Request(`${ORIGIN}/api/uploads`, {
      method: 'POST',
      headers: { Origin: ORIGIN, 'X-Recruitment-Channel': '/vagas1' },
      body: badForm,
    }),
    { DB: db }
  );
  assert.equal(badUpload.status, 400);

  // DOCX enviado fora da categoria curriculo -> 400
  const docxBuf = new ArrayBuffer(9);
  const docxBytes = new Uint8Array(docxBuf);
  docxBytes.set([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00, 0x08]);
  const docxWrongCat = new FormData();
  docxWrongCat.append('channel', '/vagas1');
  docxWrongCat.append('category', 'certificado');
  docxWrongCat.append('file', new File([docxBytes], 'cert.docx'));
  const docxWrongRes = await handleApiRequest(
    new Request(`${ORIGIN}/api/uploads`, {
      method: 'POST',
      headers: { Origin: ORIGIN, 'X-Recruitment-Channel': '/vagas1' },
      body: docxWrongCat,
    }),
    { DB: db }
  );
  assert.equal(docxWrongRes.status, 400);

  // Upload > 5 MB -> 400
  const bigBytes = makePdfBytes(5 * 1024 * 1024 + 32);
  const bigForm = new FormData();
  bigForm.append('channel', '/vagas1');
  bigForm.append('category', 'curriculo');
  bigForm.append('file', new File([bigBytes], 'grande.pdf'));
  const bigRes = await handleApiRequest(
    new Request(`${ORIGIN}/api/uploads`, {
      method: 'POST',
      headers: { Origin: ORIGIN, 'X-Recruitment-Channel': '/vagas1' },
      body: bigForm,
    }),
    { DB: db }
  );
  assert.equal(bigRes.status, 400);

  // Upload PDF multi-chunk (450 KB -> 3 chunks de 192 KB) em /vagas1
  const pdfBytes = makePdfBytes(450 * 1024);
  const expectedSha = await sha256Hex(pdfBytes);
  const okForm = new FormData();
  okForm.append('channel', '/vagas1');
  okForm.append('category', 'curriculo');
  okForm.append('file', new File([pdfBytes], 'curriculo_motorista.pdf'));
  const okUpload = await handleApiRequest(
    new Request(`${ORIGIN}/api/uploads`, {
      method: 'POST',
      headers: { Origin: ORIGIN, 'X-Recruitment-Channel': '/vagas1' },
      body: okForm,
    }),
    { DB: db }
  );
  assert.equal(okUpload.status, 201);
  const uploaded = (await okUpload.json()) as {
    fileId: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    category: string;
    sha256: string;
  };
  assert.equal(uploaded.sha256, expectedSha);

  const chunksRow = await db
    .prepare('SELECT COUNT(*) AS cnt FROM attachment_chunks WHERE attachment_id = ?')
    .bind(uploaded.fileId)
    .first<{ cnt: number }>();
  assert.equal(chunksRow?.cnt, 3, 'Arquivo de ~450 KB deve gerar 3 chunks de 192 KB no D1');

  // Tentar vincular anexo de /vagas1 em candidatura de /vagas2 -> 403
  const crossAttachRes = await handleApiRequest(
    new Request(`${ORIGIN}/api/applications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: ORIGIN,
        'X-Recruitment-Channel': '/vagas2',
      },
      body: JSON.stringify(
        buildValidApplicationPayload({
          channel: '/vagas2',
          attachments: [
            {
              fileId: uploaded.fileId,
              originalName: uploaded.originalName,
              mimeType: uploaded.mimeType,
              sizeBytes: uploaded.sizeBytes,
              category: uploaded.category,
              sha256: uploaded.sha256,
            },
          ],
        })
      ),
    }),
    { DB: db }
  );
  assert.equal(crossAttachRes.status, 403);

  // Vincular corretamente no mesmo canal /vagas1
  const validSubmit = await handleApiRequest(
    new Request(`${ORIGIN}/api/applications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: ORIGIN,
        'X-Recruitment-Channel': '/vagas1',
      },
      body: JSON.stringify(
        buildValidApplicationPayload({
          channel: '/vagas1',
          attachments: [
            {
              fileId: uploaded.fileId,
              originalName: uploaded.originalName,
              mimeType: uploaded.mimeType,
              sizeBytes: uploaded.sizeBytes,
              category: uploaded.category,
              sha256: uploaded.sha256,
            },
          ],
        })
      ),
    }),
    { DB: db }
  );
  assert.equal(validSubmit.status, 201);

  // Tentar reutilizar o mesmo fileId em nova candidatura -> 409
  const reuseRes = await handleApiRequest(
    new Request(`${ORIGIN}/api/applications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: ORIGIN,
        'X-Recruitment-Channel': '/vagas1',
      },
      body: JSON.stringify(
        buildValidApplicationPayload({
          channel: '/vagas1',
          attachments: [
            {
              fileId: uploaded.fileId,
              originalName: uploaded.originalName,
              mimeType: uploaded.mimeType,
              sizeBytes: uploaded.sizeBytes,
              category: uploaded.category,
              sha256: uploaded.sha256,
            },
          ],
        })
      ),
    }),
    { DB: db }
  );
  assert.equal(reuseRes.status, 409);

  // Download pelo tenant 1 recompõe binário exato
  const cookie1 = await loginAs(db, 'recruiter1', 'test_pass_tenant1', '198.51.100.21');
  const dl1 = await handleApiRequest(
    new Request(`${ORIGIN}/api/admin/attachments/${uploaded.fileId}`, {
      headers: { Cookie: cookie1 },
    }),
    { DB: db }
  );
  assert.equal(dl1.status, 200);
  const downloadedBytes = new Uint8Array(await dl1.arrayBuffer());
  assert.equal(await sha256Hex(downloadedBytes), expectedSha);

  // Download do mesmo anexo pelo tenant 2 -> 404 sem dados
  const cookie2 = await loginAs(db, 'recruiter2', 'test_pass_tenant2', '198.51.100.22');
  const dl2 = await handleApiRequest(
    new Request(`${ORIGIN}/api/admin/attachments/${uploaded.fileId}`, {
      headers: { Cookie: cookie2 },
    }),
    { DB: db }
  );
  assert.equal(dl2.status, 404);
});

test('Strict multi-tenant isolation across list, stats, details, PATCH status, and CSV export with formula guard', async () => {
  const db = await setupTestDb();

  // Candidatura Tenant 1 (com caractere perigoso no nome para validar proteção CSV)
  const submit1 = await handleApiRequest(
    new Request(`${ORIGIN}/api/applications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: ORIGIN,
        'X-Recruitment-Channel': '/vagas1',
        'CF-Connecting-IP': '198.51.100.31',
      },
      body: JSON.stringify(
        buildValidApplicationPayload({
          channel: '/vagas1',
          personal: {
            ...buildValidApplicationPayload().personal,
            fullName: '=CMD|"/C calc"!A0',
            email: 'tenant1.cand@example.com',
          },
        })
      ),
    }),
    { DB: db }
  );
  assert.equal(submit1.status, 201);
  const app1 = (await submit1.json()) as { applicationId: string; protocol: string };

  // Candidatura Tenant 2
  const submit2 = await handleApiRequest(
    new Request(`${ORIGIN}/api/applications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: ORIGIN,
        'X-Recruitment-Channel': '/vagas2',
        'CF-Connecting-IP': '198.51.100.32',
      },
      body: JSON.stringify(
        buildValidApplicationPayload({
          channel: '/vagas2',
          jobId: 'conferente-logistico',
          jobTitle: 'Conferente Logístico',
          jobRoleType: 'conferente',
          personal: {
            ...buildValidApplicationPayload().personal,
            fullName: 'Mariana Souza Canal 2',
            email: 'tenant2.cand@example.com',
          },
        })
      ),
    }),
    { DB: db }
  );
  assert.equal(submit2.status, 201);
  const app2 = (await submit2.json()) as { applicationId: string; protocol: string };

  const cookie1 = await loginAs(db, 'recruiter1', 'test_pass_tenant1', '198.51.100.41');
  const cookie2 = await loginAs(db, 'recruiter2', 'test_pass_tenant2', '198.51.100.42');

  // Tenant 1 tentando passar tenantId=2 na query continua vendo SOMENTE tenant 1
  const list1 = await handleApiRequest(
    new Request(`${ORIGIN}/api/admin/applications?tenantId=2&ownerId=2`, {
      headers: { Cookie: cookie1 },
    }),
    { DB: db }
  );
  assert.equal(list1.status, 200);
  const list1Data = (await list1.json()) as {
    items: Array<{ id: string; candidateEmail: string }>;
    stats: { total: number };
  };
  assert.equal(list1Data.stats.total, 1);
  assert.equal(list1Data.items.length, 1);
  assert.equal(list1Data.items[0].id, app1.applicationId);

  // Tenant 2 vê SOMENTE tenant 2
  const list2 = await handleApiRequest(
    new Request(`${ORIGIN}/api/admin/applications`, { headers: { Cookie: cookie2 } }),
    { DB: db }
  );
  assert.equal(list2.status, 200);
  const list2Data = (await list2.json()) as {
    items: Array<{ id: string; candidateEmail: string }>;
    stats: { total: number };
  };
  assert.equal(list2Data.stats.total, 1);
  assert.equal(list2Data.items.length, 1);
  assert.equal(list2Data.items[0].id, app2.applicationId);

  // Acesso cruzado GET detalhes -> 404
  const crossGet = await handleApiRequest(
    new Request(`${ORIGIN}/api/admin/applications/${app2.applicationId}`, {
      headers: { Cookie: cookie1 },
    }),
    { DB: db }
  );
  assert.equal(crossGet.status, 404);

  // Acesso cruzado PATCH status -> 404
  const crossPatch = await handleApiRequest(
    new Request(`${ORIGIN}/api/admin/applications/${app1.applicationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Origin: ORIGIN, Cookie: cookie2 },
      body: JSON.stringify({ status: 'Em análise', comment: 'Tentativa indevida' }),
    }),
    { DB: db }
  );
  assert.equal(crossPatch.status, 404);

  // PATCH próprio tenant -> 200 e histórico gravado
  const validPatch = await handleApiRequest(
    new Request(`${ORIGIN}/api/admin/applications/${app2.applicationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Origin: ORIGIN, Cookie: cookie2 },
      body: JSON.stringify({
        status: 'Em análise',
        comment: 'CNH verificada',
        internalNotes: 'Disponível para turno noturno',
      }),
    }),
    { DB: db }
  );
  assert.equal(validPatch.status, 200);

  const detail2 = await handleApiRequest(
    new Request(`${ORIGIN}/api/admin/applications/${app2.applicationId}`, {
      headers: { Cookie: cookie2 },
    }),
    { DB: db }
  );
  assert.equal(detail2.status, 200);
  const detail2Data = (await detail2.json()) as {
    application: { status: string; internalNotes: string };
    history: Array<{ toStatus: string; changedBy: string }>;
  };
  assert.equal(detail2Data.application.status, 'Em análise');
  assert.equal(detail2Data.application.internalNotes, 'Disponível para turno noturno');
  assert.equal(detail2Data.history[0].toStatus, 'Em análise');
  assert.equal(detail2Data.history[0].changedBy, 'recruiter2');

  // Exportação CSV do Tenant 1: contém apenas app1 e neutraliza fórmula `=CMD` com `'`
  const csv1Res = await handleApiRequest(
    new Request(`${ORIGIN}/api/admin/export?scope=filtered`, { headers: { Cookie: cookie1 } }),
    { DB: db }
  );
  assert.equal(csv1Res.status, 200);
  const csv1Text = await csv1Res.text();
  assert.ok(csv1Text.includes("'=CMD|"), 'Fórmula perigosa deve ser prefixada com apóstrofo no CSV');
  assert.ok(!csv1Text.includes('Mariana Souza Canal 2'), 'CSV do Tenant 1 não pode conter dados do Tenant 2');
});

test('America/Sao_Paulo inclusive date range filters and pagination behave accurately', async () => {
  const db = await setupTestDb();

  // Inserir dois registros no tenant 1 atravessando meia-noite BRT (UTC-03:00):
  // 2026-05-10T23:30:00-03:00 == 2026-05-11T02:30:00.000Z (ainda dia 10 em SP!)
  // 2026-05-11T00:30:00-03:00 == 2026-05-11T03:30:00.000Z (dia 11 em SP!)
  await db
    .prepare(
      `INSERT INTO applications (
        id, tenant_id, channel_path, protocol, idempotency_key, job_id, job_title, job_role_type, job_salary_display,
        status, candidate_name, candidate_email, candidate_phone, candidate_whatsapp, candidate_city, candidate_state,
        payload_json, internal_notes, created_at, updated_at
      ) VALUES (?, 1, '/vagas1', ?, ?, 'motorista-caminhao', 'Motorista de Caminhão', 'motorista', 'R$ 8.280,00', 'Recebida', ?, 'a@example.com', '11999990001', '', 'Campinas', 'SP', '{}', '', ?, ?)`
    )
    .bind('app_day10', 'JSL-2026-DAY10', 'k10', 'Candidato Noite Dia 10', '2026-05-11T02:30:00.000Z', '2026-05-11T02:30:00.000Z')
    .run();

  await db
    .prepare(
      `INSERT INTO applications (
        id, tenant_id, channel_path, protocol, idempotency_key, job_id, job_title, job_role_type, job_salary_display,
        status, candidate_name, candidate_email, candidate_phone, candidate_whatsapp, candidate_city, candidate_state,
        payload_json, internal_notes, created_at, updated_at
      ) VALUES (?, 1, '/vagas1', ?, ?, 'motorista-caminhao', 'Motorista de Caminhão', 'motorista', 'R$ 8.280,00', 'Recebida', ?, 'b@example.com', '11999990002', '', 'Campinas', 'SP', '{}', '', ?, ?)`
    )
    .bind('app_day11', 'JSL-2026-DAY11', 'k11', 'Candidato Madrugada Dia 11', '2026-05-11T03:30:00.000Z', '2026-05-11T03:30:00.000Z')
    .run();

  const cookie1 = await loginAs(db, 'recruiter1', 'test_pass_tenant1', '198.51.100.55');

  // Filtro somente dia 2026-05-10 em São Paulo deve retornar apenas app_day10
  const day10Res = await handleApiRequest(
    new Request(`${ORIGIN}/api/admin/applications?dateFrom=2026-05-10&dateTo=2026-05-10`, {
      headers: { Cookie: cookie1 },
    }),
    { DB: db }
  );
  assert.equal(day10Res.status, 200);
  const day10Data = (await day10Res.json()) as { items: Array<{ id: string }> };
  assert.deepEqual(
    day10Data.items.map((i) => i.id),
    ['app_day10']
  );

  // Filtro dateFrom > dateTo -> 400
  const invalidRange = await handleApiRequest(
    new Request(`${ORIGIN}/api/admin/applications?dateFrom=2026-05-12&dateTo=2026-05-10`, {
      headers: { Cookie: cookie1 },
    }),
    { DB: db }
  );
  assert.equal(invalidRange.status, 400);

  // Paginação real pageSize=1
  const page1 = await handleApiRequest(
    new Request(`${ORIGIN}/api/admin/applications?page=1&pageSize=1`, {
      headers: { Cookie: cookie1 },
    }),
    { DB: db }
  );
  const p1Data = (await page1.json()) as { items: Array<{ id: string }>; total: number; totalPages: number };
  assert.equal(p1Data.total, 2);
  assert.equal(p1Data.totalPages, 2);
  assert.equal(p1Data.items[0].id, 'app_day11');

  const page2 = await handleApiRequest(
    new Request(`${ORIGIN}/api/admin/applications?page=2&pageSize=1`, {
      headers: { Cookie: cookie1 },
    }),
    { DB: db }
  );
  const p2Data = (await page2.json()) as { items: Array<{ id: string }> };
  assert.equal(p2Data.items[0].id, 'app_day10');
});

test('Concurrent submission race on same attachment rolls back second batch atomically via trigger', async () => {
  const db = await setupTestDb();

  // 1. Upload válido de um currículo em /vagas1
  const pdfBytes = makePdfBytes(4096);
  const sha = await sha256Hex(pdfBytes);
  const form = new FormData();
  form.append('channel', '/vagas1');
  form.append('category', 'curriculo');
  form.append('file', new File([pdfBytes], 'race_curriculo.pdf'));

  const upRes = await handleApiRequest(
    new Request(`${ORIGIN}/api/uploads`, {
      method: 'POST',
      headers: { Origin: ORIGIN, 'X-Recruitment-Channel': '/vagas1' },
      body: form,
    }),
    { DB: db }
  );
  assert.equal(upRes.status, 201);
  const uploaded = (await upRes.json()) as {
    fileId: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    category: string;
    sha256: string;
  };
  assert.equal(uploaded.sha256, sha);

  const attMeta = {
    fileId: uploaded.fileId,
    originalName: uploaded.originalName,
    mimeType: uploaded.mimeType,
    sizeBytes: uploaded.sizeBytes,
    category: uploaded.category,
    sha256: uploaded.sha256,
  };

  // 2. Duas candidaturas DISTINTAS tentando vincular o MESMO fileId concorrentemente (Promise.all)
  const req1 = new Request(`${ORIGIN}/api/applications`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: ORIGIN,
      'X-Recruitment-Channel': '/vagas1',
      'CF-Connecting-IP': '198.51.100.81',
    },
    body: JSON.stringify(
      buildValidApplicationPayload({
        channel: '/vagas1',
        idempotencyKey: 'race_attach_key_1',
        personal: { ...buildValidApplicationPayload().personal, fullName: 'Candidato A' },
        attachments: [attMeta],
      })
    ),
  });

  const req2 = new Request(`${ORIGIN}/api/applications`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: ORIGIN,
      'X-Recruitment-Channel': '/vagas1',
      'CF-Connecting-IP': '198.51.100.82',
    },
    body: JSON.stringify(
      buildValidApplicationPayload({
        channel: '/vagas1',
        idempotencyKey: 'race_attach_key_2',
        personal: { ...buildValidApplicationPayload().personal, fullName: 'Candidato B' },
        attachments: [attMeta],
      })
    ),
  });

  const [res1, res2] = await Promise.all([
    handleApiRequest(req1, { DB: db }),
    handleApiRequest(req2, { DB: db }),
  ]);

  const statuses = [res1.status, res2.status].sort((a, b) => a - b);
  assert.deepEqual(statuses, [201, 409], 'Um envio deve vencer (201) e o concorrente deve abortar (409)');

  const winnerBody = (res1.status === 201 ? await res1.json() : await res2.json()) as {
    applicationId: string;
  };

  // Trigger deve ter abortado TODO o batch perdedor sem deixar nenhuma linha órfã
  const appCount = await db
    .prepare('SELECT COUNT(*) AS cnt FROM applications')
    .first<{ cnt: number }>();
  const histCount = await db
    .prepare('SELECT COUNT(*) AS cnt FROM status_history')
    .first<{ cnt: number }>();
  const attRow = await db
    .prepare('SELECT application_id FROM attachments WHERE id = ?')
    .bind(uploaded.fileId)
    .first<{ application_id: string | null }>();

  assert.equal(appCount?.cnt, 1, 'Rollback atômico: apenas 1 candidatura pode existir no banco');
  assert.equal(histCount?.cnt, 1, 'Rollback atômico: apenas 1 histórico pode existir no banco');
  assert.equal(attRow?.application_id, winnerBody.applicationId);
});

test('Concurrent idempotent submissions hit UNIQUE constraint and both return the exact saved receipt', async () => {
  const db = await setupTestDb();

  const sharedKey = 'concurrent_idem_key_001';
  const bodyPayload = JSON.stringify(
    buildValidApplicationPayload({
      channel: '/vagas2',
      idempotencyKey: sharedKey,
      personal: { ...buildValidApplicationPayload().personal, fullName: 'Candidato Idempotente' },
    })
  );

  const reqA = new Request(`${ORIGIN}/api/applications`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: ORIGIN,
      'X-Recruitment-Channel': '/vagas2',
      'CF-Connecting-IP': '198.51.100.91',
    },
    body: bodyPayload,
  });

  const reqB = new Request(`${ORIGIN}/api/applications`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: ORIGIN,
      'X-Recruitment-Channel': '/vagas2',
      'CF-Connecting-IP': '198.51.100.92',
    },
    body: bodyPayload,
  });

  const [resA, resB] = await Promise.all([
    handleApiRequest(reqA, { DB: db }),
    handleApiRequest(reqB, { DB: db }),
  ]);

  const statuses = [resA.status, resB.status].sort((a, b) => a - b);
  assert.deepEqual(statuses, [200, 201], 'Um envio cria (201) e o concorrente retorna recibo salvo (200)');

  const dataA = (await resA.json()) as { applicationId: string; protocol: string };
  const dataB = (await resB.json()) as { applicationId: string; protocol: string };
  assert.equal(dataA.applicationId, dataB.applicationId);
  assert.equal(dataA.protocol, dataB.protocol);

  const appCount = await db
    .prepare('SELECT COUNT(*) AS cnt FROM applications')
    .first<{ cnt: number }>();
  assert.equal(appCount?.cnt, 1);
});

test('SQLite trigger trg_attachments_lock_once aborts batch on cross-tenant attachment mismatch', async () => {
  const db = await setupTestDb();

  const pdfBytes = makePdfBytes(512);
  const form = new FormData();
  form.append('channel', '/vagas1');
  form.append('category', 'curriculo');
  form.append('file', new File([pdfBytes], 'tenant1.pdf'));
  const up = await handleApiRequest(
    new Request(`${ORIGIN}/api/uploads`, {
      method: 'POST',
      headers: { Origin: ORIGIN, 'X-Recruitment-Channel': '/vagas1' },
      body: form,
    }),
    { DB: db }
  );
  assert.equal(up.status, 201);
  const { fileId } = (await up.json()) as { fileId: string };

  // Simula tentativa direta no batch de vincular anexo tenant 1 a candidatura tenant 2
  const appId = crypto.randomUUID();
  const now = new Date().toISOString();
  await assert.rejects(
    async () => {
      await db.batch([
        db
          .prepare(
            `INSERT INTO applications (
              id, tenant_id, channel_path, protocol, idempotency_key, job_id, job_title, job_role_type, job_salary_display,
              status, candidate_name, candidate_email, candidate_phone, candidate_whatsapp, candidate_city, candidate_state,
              payload_json, internal_notes, created_at, updated_at
            ) VALUES (?, 2, '/vagas2', 'JSL-2026-XMISMATCH', 'k_xm', 'motorista-caminhao', 'Motorista', 'motorista', 'R$ 8.280,00', 'Recebida', 'Teste', 't@example.com', '11999990000', '', 'SP', 'SP', '{}', '', ?, ?)`
          )
          .bind(appId, now, now),
        db.prepare('UPDATE attachments SET application_id = ? WHERE id = ?').bind(appId, fileId),
      ]);
    },
    /ATTACHMENT_TENANT_MISMATCH/
  );

  // Batch inteiro deve ter sofrido rollback
  const appCount = await db
    .prepare('SELECT COUNT(*) AS cnt FROM applications')
    .first<{ cnt: number }>();
  assert.equal(appCount?.cnt, 0);
});

test('Atomic UPSERT RETURNING rate limit enforces strict cap under concurrent bursts', async () => {
  const db = await setupTestDb();

  const requests = Array.from({ length: 10 }, (_, idx) =>
    handleApiRequest(
      new Request(`${ORIGIN}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: ORIGIN,
          'CF-Connecting-IP': '198.51.100.200',
          'X-Req-Idx': String(idx),
        },
        body: JSON.stringify({ username: 'recruiter1', password: 'wrong_password' }),
      }),
      { DB: db }
    )
  );

  const responses = await Promise.all(requests);
  const statusCodes = responses.map((r) => r.status);
  const count401 = statusCodes.filter((s) => s === 401).length;
  const count429 = statusCodes.filter((s) => s === 429).length;

  assert.equal(count401, 6, 'Exatamente 6 tentativas (limite do usuário por IP) devem ser avaliadas');
  assert.equal(count429, 4, 'As 4 tentativas excedentes devem ser bloqueadas atomicamente com 429');
});

test('Identity document (front & back) uploaded under qualificacao is persisted in identityDocumentIds and returned in admin detail', async () => {
  const db = await setupTestDb();

  // Simula upload de documento com foto (PDF) na categoria qualificacao em /vagas1
  const docBytes = makePdfBytes(2048);
  const form = new FormData();
  form.append('channel', '/vagas1');
  form.append('category', 'qualificacao');
  form.append('file', new File([docBytes], 'cnh_frente_verso.pdf'));

  const upRes = await handleApiRequest(
    new Request(`${ORIGIN}/api/uploads`, {
      method: 'POST',
      headers: { Origin: ORIGIN, 'X-Recruitment-Channel': '/vagas1' },
      body: form,
    }),
    { DB: db }
  );
  assert.equal(upRes.status, 201);
  const uploaded = (await upRes.json()) as {
    fileId: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    category: string;
    sha256: string;
  };

  const submitRes = await handleApiRequest(
    new Request(`${ORIGIN}/api/applications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: ORIGIN,
        'X-Recruitment-Channel': '/vagas1',
        'CF-Connecting-IP': '198.51.100.210',
      },
      body: JSON.stringify(
        buildValidApplicationPayload({
          channel: '/vagas1',
          attachments: [
            {
              fileId: uploaded.fileId,
              originalName: uploaded.originalName,
              mimeType: uploaded.mimeType,
              sizeBytes: uploaded.sizeBytes,
              category: uploaded.category,
              sha256: uploaded.sha256,
            },
          ],
          identityDocumentIds: [uploaded.fileId],
        })
      ),
    }),
    { DB: db }
  );
  assert.equal(submitRes.status, 201);
  const { applicationId } = (await submitRes.json()) as { applicationId: string };

  const cookie1 = await loginAs(db, 'recruiter1', 'test_pass_tenant1', '198.51.100.211');
  const detailRes = await handleApiRequest(
    new Request(`${ORIGIN}/api/admin/applications/${applicationId}`, {
      headers: { Cookie: cookie1 },
    }),
    { DB: db }
  );
  assert.equal(detailRes.status, 200);
  const detailData = (await detailRes.json()) as {
    application: { identityDocumentIds?: string[] };
    attachments: Array<{ fileId: string; category: string }>;
  };

  assert.deepEqual(detailData.application.identityDocumentIds, [uploaded.fileId]);
  assert.equal(detailData.attachments.length, 1);
  assert.equal(detailData.attachments[0].fileId, uploaded.fileId);
  assert.equal(detailData.attachments[0].category, 'qualificacao');
});

test('DELETE /api/admin/applications/:id is tenant-isolated, CSRF-protected, and removes application plus attachments atomically', async () => {
  const db = await setupTestDb();

  const docBytes = makePdfBytes(200 * 1024);
  const form = new FormData();
  form.append('channel', '/vagas1');
  form.append('category', 'curriculo');
  form.append('file', new File([docBytes], 'para_excluir.pdf'));

  const upRes = await handleApiRequest(
    new Request(`${ORIGIN}/api/uploads`, {
      method: 'POST',
      headers: { Origin: ORIGIN, 'X-Recruitment-Channel': '/vagas1' },
      body: form,
    }),
    { DB: db }
  );
  assert.equal(upRes.status, 201);
  const uploaded = (await upRes.json()) as {
    fileId: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    category: string;
    sha256: string;
  };

  const submitRes = await handleApiRequest(
    new Request(`${ORIGIN}/api/applications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: ORIGIN,
        'X-Recruitment-Channel': '/vagas1',
        'CF-Connecting-IP': '198.51.100.220',
      },
      body: JSON.stringify(
        buildValidApplicationPayload({
          channel: '/vagas1',
          professionalSummary: {
            hasWorkedBefore: 'Sim',
            currentlyEmployed: 'Não',
            totalLogisticsExperience: '1 a 2 anos',
            salaryExpectation: 'R$ 8.280,00',
            startAvailability: 'Imediata',
          },
          experiences: [
            {
              id: 'exp_del_1',
              companyName: 'Transportadora Sul',
              role: 'Motorista',
              startDate: '2023-01-01',
              endDate: '2024-01-01',
              isCurrent: false,
              calculatedYears: 1,
              calculatedMonths: 0,
              durationLabel: '1 ano',
            },
          ],
          attachments: [
            {
              fileId: uploaded.fileId,
              originalName: uploaded.originalName,
              mimeType: uploaded.mimeType,
              sizeBytes: uploaded.sizeBytes,
              category: uploaded.category,
              sha256: uploaded.sha256,
            },
          ],
        })
      ),
    }),
    { DB: db }
  );
  assert.equal(submitRes.status, 201);
  const { applicationId } = (await submitRes.json()) as { applicationId: string };

  const cookie1 = await loginAs(db, 'recruiter1', 'test_pass_tenant1', '198.51.100.221');
  const cookie2 = await loginAs(db, 'recruiter2', 'test_pass_tenant2', '198.51.100.222');

  // Sem Origin -> 403
  const noOriginRes = await handleApiRequest(
    new Request(`${ORIGIN}/api/admin/applications/${applicationId}`, {
      method: 'DELETE',
      headers: { Cookie: cookie1 },
    }),
    { DB: db }
  );
  assert.equal(noOriginRes.status, 403);

  // Tenant 2 tentando excluir candidatura do Tenant 1 -> 404
  const crossDeleteRes = await handleApiRequest(
    new Request(`${ORIGIN}/api/admin/applications/${applicationId}`, {
      method: 'DELETE',
      headers: { Origin: ORIGIN, Cookie: cookie2 },
    }),
    { DB: db }
  );
  assert.equal(crossDeleteRes.status, 404);

  // Tenant 1 exclui com sucesso -> 200
  const okDeleteRes = await handleApiRequest(
    new Request(`${ORIGIN}/api/admin/applications/${applicationId}`, {
      method: 'DELETE',
      headers: { Origin: ORIGIN, Cookie: cookie1 },
    }),
    { DB: db }
  );
  assert.equal(okDeleteRes.status, 200);

  const [appsCnt, expCnt, attCnt, chunksCnt, histCnt, auditRow] = await Promise.all([
    db.prepare('SELECT COUNT(*) AS cnt FROM applications').first<{ cnt: number }>(),
    db.prepare('SELECT COUNT(*) AS cnt FROM application_experiences').first<{ cnt: number }>(),
    db.prepare('SELECT COUNT(*) AS cnt FROM attachments').first<{ cnt: number }>(),
    db.prepare('SELECT COUNT(*) AS cnt FROM attachment_chunks').first<{ cnt: number }>(),
    db.prepare('SELECT COUNT(*) AS cnt FROM status_history').first<{ cnt: number }>(),
    db
      .prepare("SELECT action, target_id FROM audit_logs WHERE action = 'DELETE_APPLICATION' AND target_id = ?")
      .bind(applicationId)
      .first<{ action: string; target_id: string }>(),
  ]);

  assert.equal(appsCnt?.cnt, 0);
  assert.equal(expCnt?.cnt, 0);
  assert.equal(attCnt?.cnt, 0);
  assert.equal(chunksCnt?.cnt, 0);
  assert.equal(histCnt?.cnt, 0);
  assert.ok(auditRow, 'Exclusão deve ficar registrada em audit_logs');
});

test('Main site submissions (entrySource=site_principal) go exclusively to tenant 2 (/vagas2) and expose origin highlight', async () => {
  const db = await setupTestDb();

  // Tentativa inválida de enviar site_principal para /vagas1 -> 400
  const invalidRes = await handleApiRequest(
    new Request(`${ORIGIN}/api/applications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: ORIGIN,
        'X-Recruitment-Channel': '/vagas1',
      },
      body: JSON.stringify(
        buildValidApplicationPayload({
          channel: '/vagas1',
          entrySource: 'site_principal',
        })
      ),
    }),
    { DB: db }
  );
  assert.equal(invalidRes.status, 400);

  // Envio válido do site principal direcionado ao canal /vagas2
  const validRes = await handleApiRequest(
    new Request(`${ORIGIN}/api/applications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: ORIGIN,
        'X-Recruitment-Channel': '/vagas2',
        'CF-Connecting-IP': '198.51.100.240',
      },
      body: JSON.stringify(
        buildValidApplicationPayload({
          channel: '/vagas2',
          entrySource: 'site_principal',
          personal: {
            ...buildValidApplicationPayload().personal,
            fullName: 'Candidato Site Principal',
          },
        })
      ),
    }),
    { DB: db }
  );
  assert.equal(validRes.status, 201);
  const created = (await validRes.json()) as {
    applicationId: string;
    channelPath: string;
    entrySource: string;
  };
  assert.equal(created.channelPath, '/vagas2');
  assert.equal(created.entrySource, 'site_principal');

  const cookie1 = await loginAs(db, 'recruiter1', 'test_pass_tenant1', '198.51.100.241');
  const cookie2 = await loginAs(db, 'recruiter2', 'test_pass_tenant2', '198.51.100.242');

  // Tenant 1 NÃO vê candidaturas do site principal
  const list1 = await handleApiRequest(
    new Request(`${ORIGIN}/api/admin/applications`, { headers: { Cookie: cookie1 } }),
    { DB: db }
  );
  const list1Data = (await list1.json()) as { items: Array<{ id: string }> };
  assert.equal(list1Data.items.length, 0);

  // Tenant 2 vê a candidatura marcada como site_principal na listagem, detalhe e CSV
  const list2 = await handleApiRequest(
    new Request(`${ORIGIN}/api/admin/applications`, { headers: { Cookie: cookie2 } }),
    { DB: db }
  );
  const list2Data = (await list2.json()) as {
    items: Array<{ id: string; entrySource: string }>;
  };
  assert.equal(list2Data.items.length, 1);
  assert.equal(list2Data.items[0].id, created.applicationId);
  assert.equal(list2Data.items[0].entrySource, 'site_principal');

  const detail2 = await handleApiRequest(
    new Request(`${ORIGIN}/api/admin/applications/${created.applicationId}`, {
      headers: { Cookie: cookie2 },
    }),
    { DB: db }
  );
  const detail2Data = (await detail2.json()) as {
    application: { entrySource: string };
  };
  assert.equal(detail2Data.application.entrySource, 'site_principal');

  const csv2 = await handleApiRequest(
    new Request(`${ORIGIN}/api/admin/export?scope=filtered`, { headers: { Cookie: cookie2 } }),
    { DB: db }
  );
  const csv2Text = await csv2.text();
  assert.ok(csv2Text.includes('Site principal'));
});

test('Application submission captures client IP and exposes it in list, detail, and CSV only for owning tenant', async () => {
  const db = await setupTestDb();

  const submitRes = await handleApiRequest(
    new Request(`${ORIGIN}/api/applications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: ORIGIN,
        'X-Recruitment-Channel': '/vagas1',
        'CF-Connecting-IP': '203.0.113.88',
      },
      body: JSON.stringify(
        buildValidApplicationPayload({
          channel: '/vagas1',
          personal: {
            ...buildValidApplicationPayload().personal,
            fullName: 'Candidato IP Teste',
          },
        })
      ),
    }),
    { DB: db }
  );
  assert.equal(submitRes.status, 201);
  const created = (await submitRes.json()) as { applicationId: string };

  const submitResXff = await handleApiRequest(
    new Request(`${ORIGIN}/api/applications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: ORIGIN,
        'X-Recruitment-Channel': '/vagas2',
        'X-Forwarded-For': '198.51.100.77, 10.0.0.1',
      },
      body: JSON.stringify(
        buildValidApplicationPayload({
          channel: '/vagas2',
          personal: {
            ...buildValidApplicationPayload().personal,
            fullName: 'Candidato IP XFF',
          },
        })
      ),
    }),
    { DB: db }
  );
  assert.equal(submitResXff.status, 201);

  const cookie1 = await loginAs(db, 'recruiter1', 'test_pass_tenant1', '198.51.100.245');
  const cookie2 = await loginAs(db, 'recruiter2', 'test_pass_tenant2', '198.51.100.246');

  const list1 = await handleApiRequest(
    new Request(`${ORIGIN}/api/admin/applications`, { headers: { Cookie: cookie1 } }),
    { DB: db }
  );
  const list1Data = (await list1.json()) as {
    items: Array<{ id: string; submittedIp: string }>;
  };
  assert.equal(list1Data.items.length, 1);
  assert.equal(list1Data.items[0].id, created.applicationId);
  assert.equal(list1Data.items[0].submittedIp, '203.0.113.88');

  const detail1 = await handleApiRequest(
    new Request(`${ORIGIN}/api/admin/applications/${created.applicationId}`, {
      headers: { Cookie: cookie1 },
    }),
    { DB: db }
  );
  const detail1Data = (await detail1.json()) as {
    application: { submittedIp: string };
  };
  assert.equal(detail1Data.application.submittedIp, '203.0.113.88');

  const csv1 = await handleApiRequest(
    new Request(`${ORIGIN}/api/admin/export?scope=filtered`, { headers: { Cookie: cookie1 } }),
    { DB: db }
  );
  const csv1Text = await csv1.text();
  assert.ok(csv1Text.includes('IP de Envio'));
  assert.ok(csv1Text.includes('203.0.113.88'));
  assert.ok(!csv1Text.includes('198.51.100.77'));

  const list2 = await handleApiRequest(
    new Request(`${ORIGIN}/api/admin/applications`, { headers: { Cookie: cookie2 } }),
    { DB: db }
  );
  const list2Data = (await list2.json()) as {
    items: Array<{ submittedIp: string }>;
  };
  assert.equal(list2Data.items.length, 1);
  assert.equal(list2Data.items[0].submittedIp, '198.51.100.77');
});

test('Submission succeeds without attachments, with hasWorkedBefore=Sim without company details, and persists gender + children', async () => {
  const db = await setupTestDb();

  const submitRes = await handleApiRequest(
    new Request(`${ORIGIN}/api/applications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: ORIGIN,
        'X-Recruitment-Channel': '/vagas1',
        'CF-Connecting-IP': '203.0.113.99',
      },
      body: JSON.stringify(
        buildValidApplicationPayload({
          channel: '/vagas1',
          personal: {
            ...buildValidApplicationPayload().personal,
            fullName: 'Maria Clara Teste',
            gender: 'Mulher',
            hasChildren: 'Sim',
            childrenCount: '2',
          },
          professionalSummary: {
            hasWorkedBefore: 'Sim',
            currentlyEmployed: '',
            totalLogisticsExperience: '',
            salaryExpectation: '',
            startAvailability: 'Imediata',
          },
          experiences: [
            {
              id: 'blank_exp_1',
              companyName: '',
              role: '',
              area: '',
              startDate: '',
              endDate: '',
              isCurrent: false,
              signedCard: '',
              lastSalary: '',
              benefits: '',
              dailyActivities: '',
              responsibilities: '',
              equipmentUsed: '',
              leaveReason: '',
              notes: '',
              calculatedYears: 0,
              calculatedMonths: 0,
              durationLabel: '',
            },
          ],
          attachments: [],
          identityDocumentIds: [],
        })
      ),
    }),
    { DB: db }
  );
  assert.equal(submitRes.status, 201);
  const created = (await submitRes.json()) as { applicationId: string };

  const cookie1 = await loginAs(db, 'recruiter1', 'test_pass_tenant1', '198.51.100.250');

  const detailRes = await handleApiRequest(
    new Request(`${ORIGIN}/api/admin/applications/${created.applicationId}`, {
      headers: { Cookie: cookie1 },
    }),
    { DB: db }
  );
  assert.equal(detailRes.status, 200);
  const detailData = (await detailRes.json()) as {
    application: {
      personal: { gender?: string; hasChildren?: string; childrenCount?: string };
      professionalSummary: { hasWorkedBefore: string };
    };
    experiences: unknown[];
    attachments: unknown[];
  };

  assert.equal(detailData.application.personal.gender, 'Mulher');
  assert.equal(detailData.application.personal.hasChildren, 'Sim');
  assert.equal(detailData.application.personal.childrenCount, '2');
  assert.equal(detailData.application.professionalSummary.hasWorkedBefore, 'Sim');
  assert.equal(detailData.experiences.length, 0);
  assert.equal(detailData.attachments.length, 0);

  const csvRes = await handleApiRequest(
    new Request(`${ORIGIN}/api/admin/export?scope=filtered`, { headers: { Cookie: cookie1 } }),
    { DB: db }
  );
  const csvText = await csvRes.text();
  assert.ok(csvText.includes('Sexo'));
  assert.ok(csvText.includes('Filhos'));
  assert.ok(csvText.includes('Mulher'));
  assert.ok(csvText.includes('Sim (2)'));
});

test('GET /api/applications/status identifies submitted IP per channel without leaking PII and resets after delete', async () => {
  const db = await setupTestDb();
  const candidateIp = '203.0.113.150';

  // Antes do envio: retorna submitted: false
  const beforeRes = await handleApiRequest(
    new Request(`${ORIGIN}/api/applications/status?channel=/vagas1`, {
      headers: { 'CF-Connecting-IP': candidateIp },
    }),
    { DB: db }
  );
  assert.equal(beforeRes.status, 200);
  const beforeData = (await beforeRes.json()) as { submitted: boolean };
  assert.equal(beforeData.submitted, false);

  // Envio pelo /vagas1
  const submitRes = await handleApiRequest(
    new Request(`${ORIGIN}/api/applications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: ORIGIN,
        'X-Recruitment-Channel': '/vagas1',
        'CF-Connecting-IP': candidateIp,
      },
      body: JSON.stringify(
        buildValidApplicationPayload({
          channel: '/vagas1',
          personal: {
            ...buildValidApplicationPayload().personal,
            fullName: 'Lucas Retorno IP',
          },
        })
      ),
    }),
    { DB: db }
  );
  assert.equal(submitRes.status, 201);
  const created = (await submitRes.json()) as { applicationId: string; protocol: string };

  // Mesmo IP no /vagas1 -> submitted: true com recibo mínimo (sem email/telefone)
  const afterRes = await handleApiRequest(
    new Request(`${ORIGIN}/api/applications/status?channel=/vagas1`, {
      headers: { 'CF-Connecting-IP': candidateIp },
    }),
    { DB: db }
  );
  assert.equal(afterRes.status, 200);
  const afterData = (await afterRes.json()) as {
    submitted: boolean;
    receipt?: {
      applicationId: string;
      protocol: string;
      candidateName: string;
      jobTitle: string;
      status: string;
      email?: string;
    };
  };
  assert.equal(afterData.submitted, true);
  assert.equal(afterData.receipt?.applicationId, created.applicationId);
  assert.equal(afterData.receipt?.protocol, created.protocol);
  assert.equal(afterData.receipt?.candidateName, 'Lucas Retorno IP');
  assert.equal(afterData.receipt?.email, undefined);

  // Isolamento: mesmo IP consultando /vagas2 NÃO enxerga inscrição de /vagas1
  const crossChannelRes = await handleApiRequest(
    new Request(`${ORIGIN}/api/applications/status?channel=/vagas2`, {
      headers: { 'CF-Connecting-IP': candidateIp },
    }),
    { DB: db }
  );
  const crossData = (await crossChannelRes.json()) as { submitted: boolean };
  assert.equal(crossData.submitted, false);

  // Outro IP no /vagas1 também retorna submitted: false
  const otherIpRes = await handleApiRequest(
    new Request(`${ORIGIN}/api/applications/status?channel=/vagas1`, {
      headers: { 'CF-Connecting-IP': '198.51.100.199' },
    }),
    { DB: db }
  );
  const otherIpData = (await otherIpRes.json()) as { submitted: boolean };
  assert.equal(otherIpData.submitted, false);

  // Se admin excluir a candidatura, o IP volta a poder se candidatar
  const cookie1 = await loginAs(db, 'recruiter1', 'test_pass_tenant1', '198.51.100.251');
  const delRes = await handleApiRequest(
    new Request(`${ORIGIN}/api/admin/applications/${created.applicationId}`, {
      method: 'DELETE',
      headers: { Origin: ORIGIN, Cookie: cookie1 },
    }),
    { DB: db }
  );
  assert.equal(delRes.status, 200);

  const afterDelRes = await handleApiRequest(
    new Request(`${ORIGIN}/api/applications/status?channel=/vagas1`, {
      headers: { 'CF-Connecting-IP': candidateIp },
    }),
    { DB: db }
  );
  const afterDelData = (await afterDelRes.json()) as { submitted: boolean };
  assert.equal(afterDelData.submitted, false);
});




