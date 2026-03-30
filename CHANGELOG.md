# Changelog

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/) e este projeto adhere a [Semantic Versioning](https://semver.org/).

## [Unreleased]

---

## [v0.4.0] - 2026-03-30

### Added
- **Health check endpoint** (`GET /health`): Verifica conectividade SQLite + campo `memoryMB`
- **X-Request-ID header**: Incluído em todas as respostas (rastreamento de requests)
- **Trivy image scan**: Adicionado ao CI para varredura de vulnerabilidades CRITICAL/HIGH
- **TruffleHog secret scanning**: Detecta secrets em push/PR (base/head corrigidos para push/PR)
- **IController.ping()**: Método exposto para verificação de conectividade DB

### Changed
- **Image tag strategy**: Push de `:latest` + SHA tag no deploy (manter 3 versões no GHCR)
- **CI/CD workflow**: Reordenação de steps, TruffleHog base/head corrigidos
- **Documentation**: SECURITY_AUDIT.md, TODO.md, NEXT-STEPS movidos para `docs/`

### Fixed
- **Cache poisoning**: Uso de `req.originalUrl` → `req.path` no cache middleware
- **TypeScript compilation**: Erros no CI/build corrigidos
- **Healthcheck setup**: Pin de image tags em docker-compose
- **CI paths**: Correções no deploy.sh e buildcache owner

### Security
- Image tag pinning em docker-compose (evita `:latest` em prod)
- TruffleHog integration + base/head correction
- Health check endpoint com SQLite validation
- Fase 1+2 completas (todos checklist itens implementados)

---

## [v0.3.0] - 2026-03-21

### Added
- **Security hardening fase 1+2** (commit 3a7add3):
  - Validação de input em todos query params
  - Graceful shutdown (SIGTERM) em Express
  - Health check endpoint (`/health`)
  - Structured logging com requestId (UUID)
- **docker-compose.prod.yml**: Configuração produção com limits (128m RAM app, 80m Redis, 32m Nginx)
- **Swagger generation no Docker build**: Executado automaticamente via `npx tsx src/swagger.ts`
- **Rate limiting**: 100 req/15min global, 20 req/15min em `/search`
- **Redis cache**: 1h TTL em GETs, 10min em search
- **SQLite indexes**: B-tree indexes para `book.id`, `verse.book_id`, `verse.text`

### Changed
- **Docker service rename**: `app` → `biblia-app`
- **Nginx upstream**: Referencia `biblia-app:3333`
- **src/swagger.ts**: Removido import de servidor, adicionado `process.exit(0)`
- **package.json**: Versões fixadas (removido `^`), `package-lock.json` adicionado
- **deploy.sh**: Configurado para single instance

### Fixed
- npm audit: vulnerabilidades críticas/altas (commit 99e621a, a9af17a)
- Swagger generation sem iniciar servidor Express (commit 8a64b96)
- CI/CD: git-lfs checkout, buildcache owner, deploy.sh paths
- Cache poisoning via `req.originalUrl`

### Security
- Redis password autenticado via `REDIS_PASSWORD`
- CORS restrito por `CORS_ORIGINS` (não `*` em prod)
- Input validation em query params
- Helmet + CSP via Nginx
- Body limit 50kb
- Ver [SECURITY_AUDIT.md](./docs/SECURITY_AUDIT.md)

---

## [v0.2.0] - 2026-02-20

### Added
- **Single instance strategy** (commit 7d79e79): ~80-100 MB RAM, Docker auto-restart
- **Performance optimizations** (commit 45a1abf):
  - SQLite WAL mode + PRAGMAs
  - Nginx proxy_cache adicional
  - B-tree indexes no build
- **Production compose** (commit fed2d90): docker-compose.prod.yml com resource limits
- **Deploy automation** (commit 896bebc): deploy.sh para SSH em VPS, image tagging por SHA
- **Package management**: package-lock.json, versões fixadas (commit b2d1039, a8e17ab)

### Changed
- **Infraestrutura**: Reduzido de multi-instance para single biblia-app
- **Deployment**: GHCR image tagging com SHA do commit
- **CI/CD**: Melhoria em checkout, buildcache, deploy workflow

### Fixed
- npm audit: fixação de vulnerabilidades
- CI/CD paths e buildcache owner

---

## [v0.1.0] - Initial Release (até 2026-02-15)

### Foundation: Scaffold & Endpoints
**Commits: 5f8ccb5 até 22bda82**

- Initial commit: estrutura Express + TypeScript (ESM modules)
- Swagger gerador dinâmico (detecta IP automaticamente)
- Controllers e middlewares base
- Suporte a 6 traduções: ARC, NVI, NTLH, KJA, KJF, ACF
- Bible reference parser (suporta "João 3:16", "Gn 1-3", etc)

### Endpoints Base
- `GET /` — API info
- `GET /versions` — Lista traduções
- `GET /books` — Lista livros
- `GET /books/:bookId` — Livro por ID
- `GET /books/testament/:testamentId` — Livros por testamento
- `GET /verses/:bookId` — Versículos do livro
- `GET /verses/:bookId/:chapterId` — Versículos por capítulo
- `GET /search?query=` — Busca por texto
- `GET /docs` — Swagger interativo

### Containerização
**Commits: 2f61ee0 até 99389c6**

- Dockerfile multi-stage (builder + runner)
- docker-compose.yaml (Express + Postgres, depois removido)
- Nginx reverse proxy com CORS
- CI/CD via GitHub Actions (.github/workflows/deploy.yml)
- Docker images com Node 22 oficial

### Security & Headers
**Commits: 50898d5 até 017c752**

- Helmet security headers
- CORS dinâmico baseado em HOSTNAME/PORT
- Rate limiting (express-rate-limit)
- Body parser limits
- Nginx security headers

### Cache & Database
**Commits: 11825b0 até 45a1abf**

- Redis cache middleware (1h TTL)
- SQLite como banco de dados (6 arquivos, um por tradução)
- Database schema com tabelas: book, verse, testament, metadata
- Cache key strategy: `cache:{path}`
- Search com TTL reduzido (10min)

### Infrastructure & Logging
**Commits: fed2d90 até 2f596a3**

- Structured logging com requestId (UUID v4)
- Graceful shutdown (SIGTERM handler)
- Suporte a NODE_ENV (development/production)
- Environment variables: HTTP_PORT, REDIS_HOST, etc

---

## Endpoints Estáveis

| Method | Path | Cache | Rate Limit |
|--------|------|-------|-----------|
| GET | `/` | ✓ | 100/15m |
| GET | `/health` | ✓ | 100/15m |
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

## Histórico de Commits Principais

### Initial Phase (5f8ccb5 - 22bda82)
- Scaffold inicial com Express + TypeScript
- Setup de Docker e Nginx
- Primeiros endpoints e controllers
- Swagger gerador dinâmico

### Segurança Fase 0 (99e621a - 017c752)
- npm audit fixes (crítico/alto)
- Rate limiting
- Helmet headers
- CORS dinâmico

### Cache & Performance (11825b0 - 45a1abf)
- Redis cache middleware
- SQLite indexes
- Nginx proxy_cache
- WAL mode + PRAGMAs

### Deployment & Infrastructure (50898d5 - 896bebc)
- CI/CD setup
- deploy.sh automation
- Single instance strategy
- docker-compose.prod.yml
- package-lock.json

### Logging & Robustez (2f596a3 - fed2d90)
- Structured logging
- Graceful shutdown
- Swagger generation no build

### Swagger & Fixes (1865c40 - 6108c77)
- Remove server import from swagger.ts
- Cache poisoning fix (req.originalUrl)
- Swagger generation in Docker build

### Security Hardening (3a7add3 - 0ac17cc)
- Validação de input
- Health check endpoint
- CI secret scanning
- Image tag pinning

### Recent Improvements (2026-03-21 onwards)
- CI/CD workflow refinements
- TruffleHog base/head fixes
- TypeScript compilation fixes
- Documentation organization (docs/ folder)
- X-Request-ID header
- Trivy image scanning
