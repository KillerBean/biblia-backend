# Security Audit Report
**Date:** 2026-03-12

## CRÍTICO

| # | Problema | Local | Status |
|---|----------|-------|--------|
| C1 | Redis sem autenticação — qualquer container na mesma network acessa o cache | `docker-compose.yaml` | ✅ Corrigido |
| C2 | Sem HTTPS — nginx só escuta na porta 80 | `nginx.conf:37` | ⚠️ Depende de certs no VPS |
| C3 | Sem validação no input de busca — sem limite de tamanho, risco de ReDoS | `src/router.ts:106` | ✅ Corrigido |
| C4 | `start`/`end` sem validação de NaN/bounds | `src/router.ts:89-90` | ✅ Corrigido |

## ALTO

| # | Problema | Local | Status |
|---|----------|-------|--------|
| A1 | Sem error handler global — stack traces podem vazar | `src/index.ts` | ✅ Corrigido |
| A2 | 404 handler não envia body | `src/index.ts:69-71` | ✅ Corrigido |
| A3 | Rate limit único global — `/search` deveria ter limite mais restrito | `src/index.ts:27-32` | Pendente |
| A4 | Sem limite de tamanho de request | `src/index.ts` | ✅ Corrigido (bodyParser limit) |

## MÉDIO

| # | Problema | Local | Status |
|---|----------|-------|--------|
| M1 | Sem Content-Security-Policy header | `nginx.conf` | Pendente |
| M2 | `X-XSS-Protection` depreciado | `nginx.conf:41` | Pendente |
| M3 | CORS irrestrito em dev (`origin: true`) | `src/index.ts:44` | Pendente |
| M4 | HOSTNAME via auto-detect de IP sem validação | `src/index.ts:18` | Pendente |

## BAIXO

| # | Problema | Local | Status |
|---|----------|-------|--------|
| B1 | `console.log` em código de produção | `src/services/redis-service.ts` | Pendente |
| B2 | Sem `package-lock.json` | `/` | Pendente |
| B3 | Versões de pacotes com `^` — permite atualizações automáticas | `package.json` | Pendente |

## Notas
- `.env` está no `.gitignore` e nunca foi commitado — não há exposição de credenciais no histórico git.
- HTTPS deve ser configurado via certificados SSL no VPS. O nginx está atrás de um proxy externo (`vps-network`); verificar se TLS termination já ocorre upstream.
