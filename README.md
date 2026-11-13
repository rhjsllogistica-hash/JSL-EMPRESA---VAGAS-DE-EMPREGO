# Portal de recrutamento

Aplicação React/Vite publicada no Cloudflare Pages com backend Pages Functions e banco D1.

- Painel administrativo: `/painel`.
- Canal de candidaturas 1: `/vagas1`.
- Canal de candidaturas 2: `/vagas2`.
- Cada recrutador acessa somente os dados vinculados à sua sessão.

## Publicação

A branch de produção é `main`. O Cloudflare compila com `npx vite build` e publica a pasta `dist`. A configuração do banco está em `wrangler.jsonc`, com binding `DB`.

Antes de publicar alterações no backend, aplicar as migrações SQL de `migrations/` no D1 de produção. Credenciais de usuários são provisionadas somente no banco, nunca neste repositório. Consulte `DEPLOY_CLOUDFLARE.md` para os demais detalhes.

A publicação deve ser conferida pelo commit da branch main no Cloudflare, além da abertura das rotas /painel, /vagas1 e /vagas2 no domínio de produção.
