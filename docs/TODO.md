# TODO — biblia_backend

## Fase 1+2 — Completo ✓

- [x] **Structured Logging** — middleware `src/middlewares/logger.ts` com `requestId` (UUID)
- [x] **Graceful Shutdown** — `src/index.ts` captura `SIGTERM`
- [x] **Fixar versões de pacotes** — `^` removido, package-lock.json adicionado
- [x] **Health check endpoint** — `/health` com SQLite validation + memoryMB
- [x] **X-Request-ID header** — Incluído em todas as respostas
- [x] **Trivy + TruffleHog** — Image scan + secret scanning no CI

---

## Implementado

- [x] Rate limiting (100 req/15min global, 20 req/15min em `/search`)
- [x] Redis autenticado via `REDIS_PASSWORD`
- [x] Helmet + CSP
- [x] Body limit 50kb
- [x] Validação de input em query params
- [x] CORS restrito por `CORS_ORIGINS`
- [x] Multi-stage Dockerfile (testes + índices SQLite)
- [x] Deploy com tag SHA via `deploy.sh`
- [x] Image tag pinning
- [x] Secret scanning (TruffleHog)

---

## Próximos passos

Ver [NEXT-STEPS-2026-03-21.md](./NEXT-STEPS-2026-03-21.md) para planejamento de futuras fases.
