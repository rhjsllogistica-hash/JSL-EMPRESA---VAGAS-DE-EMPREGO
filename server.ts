import fs from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import express, { type Request as ExpressRequest, type Response as ExpressResponse } from 'express';
import { handleApiRequest } from './src/server/apiHandler.ts';
import { LocalSqliteD1Adapter } from './src/server/localD1Adapter.ts';

const PORT = 3000;

async function toWebRequest(req: ExpressRequest): Promise<globalThis.Request> {
  const host = req.get('host') || `localhost:${PORT}`;
  const proto = (req.headers['x-forwarded-proto'] as string)?.split(',')[0]?.trim() || req.protocol || 'http';
  const url = `${proto}://${host}${req.originalUrl}`;

  const headers = new Headers();
  for (const [key, val] of Object.entries(req.headers)) {
    if (Array.isArray(val)) {
      val.forEach((v) => headers.append(key, v));
    } else if (typeof val === 'string') {
      headers.set(key, val);
    }
  }

  const method = req.method.toUpperCase();
  const hasBody = method !== 'GET' && method !== 'HEAD';

  let body: BodyInit | undefined;
  if (hasBody) {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    body = Buffer.concat(chunks);
  }

  return new Request(url, {
    method,
    headers,
    body,
  });
}

async function sendWebResponse(webRes: globalThis.Response, res: ExpressResponse): Promise<void> {
  res.status(webRes.status);
  webRes.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie') {
      res.append('Set-Cookie', value);
    } else {
      res.setHeader(key, value);
    }
  });

  if (!webRes.body) {
    res.end();
    return;
  }

  const reader = webRes.body.getReader();
  const nodeStream = new Readable({
    async read() {
      try {
        const { done, value } = await reader.read();
        if (done) {
          this.push(null);
        } else {
          this.push(Buffer.from(value));
        }
      } catch (err) {
        this.destroy(err instanceof Error ? err : new Error(String(err)));
      }
    },
  });
  nodeStream.pipe(res);
}

async function startServer() {
  const dbPath = path.resolve(process.cwd(), '.dev-data', 'local-d1.sqlite');
  const d1 = new LocalSqliteD1Adapter(dbPath);
  const migrationsDir = path.resolve(process.cwd(), 'migrations');
  const migrationFiles = (await fs.readdir(migrationsDir))
    .filter((file) => file.endsWith('.sql'))
    .sort();
  for (const file of migrationFiles) {
    const sql = await fs.readFile(path.join(migrationsDir, file), 'utf-8');
    d1.applyMigration(sql);
  }

  const app = express();

  app.all('/api/*', async (req, res) => {
    try {
      const webReq = await toWebRequest(req);
      const webRes = await handleApiRequest(webReq, { DB: d1 });
      await sendWebResponse(webRes, res);
    } catch (err) {
      console.error('Erro no adaptador local de API:', err);
      res.status(500).json({ error: 'Erro interno no servidor local.' });
    }
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
    app.use(express.static(distPath, { index: false }));
    app.get('*', async (req, res) => {
      try {
        const htmlPath = path.join(distPath, 'index.html');
        let html = await fs.readFile(htmlPath, 'utf-8');
        const host = req.get('host') || `localhost:${PORT}`;
        const proto =
          (req.headers['x-forwarded-proto'] as string)?.split(',')[0]?.trim() ||
          req.protocol ||
          'http';
        const origin = `${proto}://${host}`;
        const absoluteImageUrl = `${origin}/assets/whatsapp-preview-jsl.jpg`;
        html = html
          .split('content="/assets/whatsapp-preview-jsl.jpg"')
          .join(`content="${absoluteImageUrl}"`);
        res.type('html').send(html);
      } catch {
        res.sendFile(path.join(distPath, 'index.html'));
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Portal JSL Empresa (dev adapter D1) ativo em http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Falha ao iniciar servidor:', err);
  process.exit(1);
});
