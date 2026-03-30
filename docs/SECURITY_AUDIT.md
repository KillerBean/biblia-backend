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
| A3 | Rate limit único global — `/search` deveria ter limite mais restrito | `src/index.ts:27-32` | ✅ Corrigido |
| A4 | Sem limite de tamanho de request | `src/index.ts` | ✅ Corrigido (bodyParser limit) |

## MÉDIO

| # | Problema | Local | Status |
|---|----------|-------|--------|
| M1 | Sem Content-Security-Policy header | `nginx.conf` | ✅ Corrigido |
| M2 | `X-XSS-Protection` depreciado | `nginx.conf:41` | ✅ Corrigido |
| M3 | CORS irrestrito em dev (`origin: true`) | `src/index.ts:44` | ✅ Corrigido |
| M4 | HOSTNAME via auto-detect de IP sem validação | `src/index.ts:18` | ✅ Corrigido |

## BAIXO

| # | Problema | Local | Status |
|---|----------|-------|--------|
| B1 | `console.log` em código de produção | `src/services/redis-service.ts` | ✅ Corrigido |
| B2 | Sem `package-lock.json` | `/` | ✅ Corrigido |
| B3 | Versões de pacotes com `^` — permite atualizações automáticas | `package.json` | ✅ Corrigido |

## Revisão 2026-03-30 (Fase 2)

Findings adicionais identificados na revisão de código de 2026-03-21:

### Crítico / Alto — Corrigidos

| # | Problema | Local | Status |
|---|----------|-------|--------|
| N1 | Conteúdo de busca armazenado no Redis (PII implícito) | `src/middlewares/cache.ts` | ✅ Corrigido — chave usa SHA-256 do originalUrl |
| N2 | Cache key injection / pollution via `req.originalUrl` | `src/middlewares/cache.ts` | ✅ Corrigido — SHA-256 elimina chars especiais |
| N3 | Graceful shutdown sem timeout para in-flight requests | `src/index.ts` | ✅ Corrigido — timeout 30s + SIGINT handler |
| N4 | Error handler sem `requestId` na resposta | `src/index.ts` | ✅ Corrigido |
| N5 | Input validation incompleta (sem upper bounds) | `src/router.ts` | ✅ Corrigido — bookId≤66, chapterId≤150, start/end≤176, name≤100 |
| N6 | CI configurado para branch `main` (branch é `master`) | `.github/workflows/ci.yml` | ✅ Corrigido |
| N7 | CI usava `npm install` em vez de `npm ci` | `.github/workflows/ci.yml` | ✅ Corrigido |
| N8 | GitHub Actions sem SHA pins (supply chain) | `.github/workflows/ci.yml` | ✅ Corrigido |
| N9 | CI sem type check, npm audit e scan de imagem | `.github/workflows/ci.yml` | ✅ Corrigido — tsc, npm audit, Trivy |
| N10 | Sem scan de secrets no CI | `.github/workflows/secret-scan.yml` | ✅ Corrigido — TruffleHog |
| N11 | `unhandledRejection` / `uncaughtException` não tratados | `src/index.ts` | ✅ Corrigido |
| N12 | REDIS_PASSWORD não validado no startup em produção | `src/index.ts` | ✅ Corrigido |

### Pendente

| # | Problema | Prioridade |
|---|----------|-----------|
| P1 | HTTPS/TLS no VPS | Crítico — depende de infra |
| P2 | SQLite hardcoded como ARC — multi-versão não roteada | Médio |
| P3 | Sem timeout em queries SQLite (busy_timeout) | Médio |
| P4 | Redis sem `connectTimeout` | Médio |
| P5 | Cobertura de testes < 80% (middlewares/controllers) | Médio |

## Notas
- `.env` está no `.gitignore` e nunca foi commitado — não há exposição de credenciais no histórico git.
- HTTPS deve ser configurado via certificados SSL no VPS. O nginx está atrás de um proxy externo (`vps-network`); verificar se TLS termination já ocorre upstream.
