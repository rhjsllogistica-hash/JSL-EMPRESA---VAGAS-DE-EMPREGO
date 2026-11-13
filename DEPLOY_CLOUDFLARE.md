# Deploy em Produção — Cloudflare Pages + Pages Functions + D1

Este projeto roda em produção no **Cloudflare Pages** com **Pages Functions** (`functions/api/[[path]].ts`) e banco de dados **Cloudflare D1** vinculado como `DB`.

## 1. Configuração do Build no Cloudflare Pages
- **Framework preset**: None / Vite
- **Build command**: `npx vite build`
- **Build output directory**: `dist`
- **Variáveis/Bindings**:
  - **D1 Database Binding**: `DB` -> `jsl-recrutamento` (UUID `ec45e2c5-4918-44d4-aee3-270efaf1b805`, Account ID `20657a66879f80c35e302f86b1914530`, configurado em `wrangler.jsonc`).

## 2. Aplicação do Schema D1 (`migrations/*.sql`)
Execute as migrations no banco D1 `jsl-recrutamento` em ordem numérica usando o **Console SQL do D1 no Dashboard da Cloudflare** ou via Wrangler:

```bash
npx wrangler d1 execute jsl-recrutamento --remote --file=migrations/0001_recruitment.sql
npx wrangler d1 execute jsl-recrutamento --remote --file=migrations/0002_atomic_triggers.sql
```

## 3. Criação dos Usuários Administrativos
Por segurança, **nenhuma senha ou hash PBKDF2 fica versionado no repositório**.
Após aplicar `migrations/0001_recruitment.sql`, execute no console SQL do D1 (`jsl-recrutamento`) o comando privado `INSERT INTO users (...)` gerado com `pbkdf2_sha256$100000$...`:
- `tenant_id = 1` -> recebe exclusivamente cadastros e anexos de `/vagas1`
- `tenant_id = 2` -> recebe exclusivamente cadastros e anexos de `/vagas2`

## 4. Rotas em Produção
- Canal 1 (Tenant 1): `/vagas1`, `/vagas1/vagas`, `/vagas1/vagas/<slug>`, `/vagas1/candidatura`, `/vagas1/confirmacao`
- Canal 2 (Tenant 2): `/vagas2`, `/vagas2/vagas`, `/vagas2/vagas/<slug>`, `/vagas2/candidatura`, `/vagas2/confirmacao`
- Painel Administrativo: `/admin`
- API Pages Functions: `/api/*` (`functions/api/[[path]].ts`)

> O arquivo `server.ts` é utilizado apenas como adaptador de desenvolvimento local com SQLite (`node:sqlite`), simulando o D1 em `.dev-data/local.sqlite`. Em produção no Cloudflare Pages, apenas `dist/` e `functions/` são servidos.
