# Changelog

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/) e este projeto adhere a [Semantic Versioning](https://semver.org/).

## [Unreleased]

---

## [Current] - 2026-03-21

### Added
- **docker-compose.prod.yml**: Nova configuração para produção com limits (128m RAM app, 80m Redis, 32m Nginx)
- **Swagger generation no Docker build**: Executado automaticamente via `npx tsx src/swagger.ts`
- **Graceful Shutdown**: SIGTERM handler em Express que fecha server + redis
- **Structured Logging**: Middleware com requestId (UUID), method, path, status, duration, IP
- **Rate limiting**: 100 req/15min global, 20 req/15min em `/search`
- **Redis cache**: 1h TTL em todas as rotas GET (except search que é 10min)
- **Security headers**: Helmet + CSP via Nginx, body limit 50kb
- **SQLite indexes**: B-tree indexes para `book.id`, `verse.book_id`, `verse.text` (gerados no Docker build)

### Changed
- **Serviço Docker**: `app` → `biblia-app` em docker-compose
- **Upstream Nginx**: Referencia `biblia-app:3333`
- **src/swagger.ts**: Removido `await import('./index.ts')`, adicionado `process.exit(0)`
- **package.json**: Versões fixadas (sem `^`)
- **deploy.sh**: Single instance (`biblia-app` apenas)

### Fixed
- Vulnerabilidades críticas e altas (npm audit)
- Swagger geração sem iniciar servidor Express
- CI/CD: deploy.sh corrigido, buildcache owner, git-lfs checkout

### Security
- Redis password autenticado via `REDIS_PASSWORD` (obrigatório em prod)
- CORS restrito a `CORS_ORIGINS` (não `*` em produção)
- Input validation em query params (book, chapter, testament)
- Body limit 50kb
- See [SECURITY_AUDIT.md](./SECURITY_AUDIT.md)

---

## Histórico de Marcos

### v0.1.0 - Foundation (até commit ff8c1f2)

**Fase 1: Scaffold & Endpoints**
- Initial commit: estrutura Express + TypeScript ESM
- Swagger gerador dinâmico (detecta IP)
- Primeiros endpoints: `/`, `/versions`, `/books`, `/verses`
- Suporte a 6 traduções (ARC, NVI, NTLH, KJA, KJF, ACF)
- Search endpoint com parser de referências bíblicas

**Fase 2: Containerização**
- Dockerfile multi-stage (Node.js oficial)
- docker-compose com Express + Postgres (depois removido)
- Nginx reverse proxy com CORS
- CI/CD: GitHub Actions (.github/workflows/deploy.yml)

**Fase 3: Segurança**
- Helmet headers
- CORS baseado em HOSTNAME/PORT detectados
- Rate limiting (express-rate-limit)
- Body parser limits

**Fase 4: Cache & Perf (até 45a1abf)**
- Redis cache middleware (1h TTL para GETs, 10min para search)
- SQLite PRAGMA otimizations (WAL mode, shared_cache, page_size)
- Nginx proxy_cache adicional
- Índices B-tree no SQLite

### v0.2.0 - Infrastructure (até 896bebc)

**Deploy & Infra**
- deploy.sh: automação SSH para VPS
- Single instance strategy (~80-100 MB RAM)
- Resource limits via docker-compose.prod.yml
- Image tagging por commit SHA via GHCR

**CI/CD Improvements**
- npm audit: fixou vulnerabilidades críticas/altas
- package-lock.json adicionado
- Versões de pacotes fixadas (removido `^`)
- Tests na stage builder do Dockerfile

### v0.3.0 - Refinement (até d3f3ecc)

**Robustez**
- Graceful shutdown: SIGTERM handler
- Structured logging: requestId (UUID)
- Swagger generation no Docker build

**Recent Fixes**
- swagger.ts: removeu server startup, adicionado process.exit(0)
- docker-compose renaming: app → biblia-app
- Nginx upstream atualizado

---

## Endpoints Estáveis

| Method | Path | Cache | Rate Limit |
|--------|------|-------|-----------|
| GET | `/` | ✓ | 100/15m |
| GET | `/versions` | ✓ | 100/15m |
| GET | `/books` | ✓ | 100/15m |
| GET | `/books/:bookId` | ✓ | 100/15m |
| GET | `/books/:bookId/chapters` | ✓ | 100/15m |
| GET | `/books/testament/:testamentId` | ✓ | 100/15m |
| GET | `/verses/:bookId` | ✓ | 100/15m |
| GET | `/verses/:bookId/:chapterId` | ✓ | 100/15m |
| GET | `/search?query=...` | ✓ | 20/15m |
| GET | `/docs` | — | 100/15m |

---

## Pendências

- [ ] Commitar `package-lock.json` (versões fixadas já estão em package.json)
- [ ] Validar graceful shutdown em produção (testar SIGTERM)
- [ ] Adicionar healthcheck endpoint (`GET /health`)
- [ ] Melhorar docs do search (suporta "João 3:16", "Gn 1-3", "Mt 5:5-7")
