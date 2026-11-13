import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import express, { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { adminAuth } from './src/lib/firebase-admin.ts';
import {
  availabilitySchema,
  calculateWorkDuration,
  educationSchema,
  personalSchema,
  workExperienceSchema,
} from './src/lib/validation.ts';

const PORT = 3000;
const PRIVATE_UPLOAD_DIR = path.resolve(process.cwd(), 'private_uploads');
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const ALLOWED_ADMIN_EMAILS = new Set<string>(['rh.jsl.logistica@gmail.com']);

// Limitação simples de requisições por IP (janela deslizante em memória)
const rateLimitBuckets = new Map<string, number[]>();

function createRateLimiter(maxRequests: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      'unknown';
    const key = `${req.path}:${ip}`;
    const now = Date.now();
    const recent = (rateLimitBuckets.get(key) || []).filter((ts) => now - ts < windowMs);
    if (recent.length >= maxRequests) {
      return res.status(429).json({
        error: 'Muitas tentativas em sequência. Aguarde alguns minutos e tente novamente.',
      });
    }
    recent.push(now);
    rateLimitBuckets.set(key, recent);
    next();
  };
}

interface AuthRequest extends Request {
  adminUser?: {
    uid: string;
    email: string;
  };
}

async function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Não autorizado: token ausente.' });
  }
  const token = authHeader.slice(7).trim();
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    if (!decoded.email || !decoded.email_verified) {
      return res.status(403).json({ error: 'Acesso negado: e-mail não verificado.' });
    }
    if (!ALLOWED_ADMIN_EMAILS.has(decoded.email.toLowerCase())) {
      return res.status(403).json({ error: 'Acesso restrito a administradores autorizados.' });
    }
    req.adminUser = { uid: decoded.uid, email: decoded.email };
    next();
  } catch (err) {
    console.error('Erro ao verificar token administrativo:', err);
    return res.status(401).json({ error: 'Sessão administrativa inválida ou expirada.' });
  }
}

function detectFileSignature(
  buffer: Buffer,
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

  // DOCX (somente para currículo): ZIP PK\x03\x04 + extensão .docx
  const lowerName = originalName.toLowerCase();
  if (
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04 &&
    lowerName.endsWith('.docx')
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

const issuedProtocols = new Set<string>();

function generateUniqueProtocol(): string {
  const year = new Date().getFullYear();
  for (let i = 0; i < 10; i++) {
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    const protocol = `JSL-${year}-${code}`;
    if (!issuedProtocols.has(protocol)) {
      issuedProtocols.add(protocol);
      return protocol;
    }
  }
  return `JSL-${year}-${Date.now().toString(36).toUpperCase()}`;
}

const prepareApplicationSchema = z.object({
  honeypot: z.string().max(0, 'Envio bloqueado por proteção antispam.').optional().default(''),
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

async function startServer() {
  await fs.mkdir(PRIVATE_UPLOAD_DIR, { recursive: true });

  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 1 },
  });

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Upload seguro de currículo e certificados com validação real de assinatura (magic bytes)
  app.post('/api/uploads', createRateLimiter(20, 15 * 60 * 1000), (req, res) => {
    upload.single('file')(req, res, async (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'Arquivo excede o limite máximo de 5 MB.' });
        }
        return res.status(400).json({ error: `Erro no upload: ${err.message}` });
      }
      if (err) {
        return res.status(400).json({ error: 'Falha ao processar o arquivo enviado.' });
      }
      if (!req.file) {
        return res.status(400).json({ error: 'Nenhum arquivo foi enviado.' });
      }

      const category = String(req.body?.category || 'curriculo');
      if (!['curriculo', 'certificado', 'curso', 'qualificacao'].includes(category)) {
        return res.status(400).json({ error: 'Categoria de anexo inválida.' });
      }

      const safeOriginalName = path
        .basename(req.file.originalname || 'documento')
        .replace(/[^\w.\-() ]+/g, '_')
        .slice(0, 180);

      const detection = detectFileSignature(req.file.buffer, safeOriginalName, category);
      if (!detection.valid) {
        return res.status(400).json({ error: detection.error });
      }

      const fileId = crypto.randomUUID();
      const sha256 = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
      const uploadedAt = new Date().toISOString();

      await fs.writeFile(path.join(PRIVATE_UPLOAD_DIR, `${fileId}.bin`), req.file.buffer);
      await fs.writeFile(
        path.join(PRIVATE_UPLOAD_DIR, `${fileId}.json`),
        JSON.stringify({
          fileId,
          originalName: safeOriginalName,
          mimeType: detection.mimeType,
          sizeBytes: req.file.size,
          category,
          sha256,
          uploadedAt,
        })
      );

      res.status(201).json({
        fileId,
        originalName: safeOriginalName,
        mimeType: detection.mimeType,
        sizeBytes: req.file.size,
        category,
        sha256,
        uploadedAt,
      });
    });
  });

  // Validação integral no servidor + recálculo de tempo trabalhado + geração única de protocolo
  app.post('/api/applications/prepare', createRateLimiter(12, 15 * 60 * 1000), (req, res) => {
    const parsed = prepareApplicationSchema.safeParse(req.body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return res.status(400).json({
        error: firstIssue?.message || 'Dados inválidos no formulário de candidatura.',
        issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }

    const data = parsed.data;

    if (data.professionalSummary.hasWorkedBefore === 'Sim' && data.experiences.length === 0) {
      return res.status(400).json({
        error: 'Adicione ao menos uma experiência profissional ou selecione primeiro emprego.',
      });
    }

    const normalizedExperiences = data.experiences.map((exp) => {
      const duration = calculateWorkDuration(exp.startDate, exp.endDate || '', exp.isCurrent);
      if (!duration.valid) {
        throw new Error(`Experiência em "${exp.companyName}": ${duration.label}`);
      }
      return {
        ...exp,
        calculatedYears: duration.years,
        calculatedMonths: duration.months,
        durationLabel: duration.label,
      };
    });

    const protocol = generateUniqueProtocol();
    return res.status(200).json({
      protocol,
      normalizedExperiences,
      validatedAt: new Date().toISOString(),
    });
  });

  // Download privado de anexos restrito exclusivamente a administradores autenticados
  app.get('/api/admin/attachments/:fileId', requireAdmin, async (req: AuthRequest, res: Response) => {
    const fileId = req.params.fileId;
    if (!/^[a-zA-Z0-9_-]+$/.test(fileId)) {
      return res.status(400).json({ error: 'Identificador de arquivo inválido.' });
    }

    const metaPath = path.join(PRIVATE_UPLOAD_DIR, `${fileId}.json`);
    const binPath = path.join(PRIVATE_UPLOAD_DIR, `${fileId}.bin`);

    try {
      const metaRaw = await fs.readFile(metaPath, 'utf-8');
      const meta = JSON.parse(metaRaw);
      const buffer = await fs.readFile(binPath);

      res.setHeader('Content-Type', meta.mimeType || 'application/octet-stream');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${encodeURIComponent(meta.originalName || 'anexo')}"`
      );
      res.setHeader('Cache-Control', 'no-store');
      res.send(buffer);
    } catch {
      return res.status(404).json({ error: 'Anexo não encontrado no armazenamento privado.' });
    }
  });

  // Exclusão física de anexo (atendimento a solicitação LGPD pelo administrador)
  app.delete('/api/admin/attachments/:fileId', requireAdmin, async (req: AuthRequest, res: Response) => {
    const fileId = req.params.fileId;
    if (!/^[a-zA-Z0-9_-]+$/.test(fileId)) {
      return res.status(400).json({ error: 'Identificador de arquivo inválido.' });
    }
    try {
      await fs.rm(path.join(PRIVATE_UPLOAD_DIR, `${fileId}.json`), { force: true });
      await fs.rm(path.join(PRIVATE_UPLOAD_DIR, `${fileId}.bin`), { force: true });
      res.json({ deleted: true });
    } catch {
      res.status(500).json({ error: 'Falha ao remover anexo.' });
    }
  });

  // Sincronização de e-mails de administradores adicionais pelo super-admin
  app.post('/api/admin/allowlist', requireAdmin, (req: AuthRequest, res: Response) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'E-mail inválido.' });
    }
    ALLOWED_ADMIN_EMAILS.add(email);
    res.json({ allowed: Array.from(ALLOWED_ADMIN_EMAILS) });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Portal JSL Empresa ativo em http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Falha ao iniciar servidor:', err);
  process.exit(1);
});
