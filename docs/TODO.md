# TODO — biblia_backend

## Pendências identificadas no CLAUDE.md

- [x] **Structured Logging** — middleware `src/middlewares/logger.ts` com `requestId` (crypto.randomUUID), loga `req.path` (sem query string para evitar PII)

- [x] **Graceful Shutdown** — `src/index.ts` captura `SIGTERM`: `server.close()` → `redisClient.quit()` → `process.exit(0)`

- [x] **Fixar versões de pacotes** — `^` removido de todas as deps em `package.json`
  - [ ] Commitar `package-lock.json` junto (rodar `npm install` e commitar o lock)

---

## Já implementado

- [x] Rate limiting (100 req/15min global, 20 req/15min em `/search`)
- [x] Redis autenticado via `REDIS_PASSWORD`
- [x] Helmet
- [x] Body limit 50kb
- [x] Validação de input nos query params
- [x] CORS restrito por `CORS_ORIGINS`
- [x] Multi-stage Dockerfile (testes + índices SQLite no builder, `USER node` no runner)
- [x] Deploy com tag SHA via `deploy.sh`
