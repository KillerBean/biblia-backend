# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Bible Backend API - A REST API serving Bible text in Portuguese with multiple translations. Built with Express.js and TypeScript (ESM modules), using SQLite databases for Bible content and Redis for caching.

## Common Commands

```bash
npm run dev          # Development server with hot reload
npm test             # Run Jest tests
npm run swagger      # Regenerate Swagger documentation
npm start            # Production start (no hot reload)
```

**Docker deployment:**
```bash
./launch.sh -a       # Full deploy (down + up)
./launch.sh -u       # Build and start containers
./launch.sh -d       # Stop and remove containers
```

## Architecture

### Request Flow
```
Nginx → Express (app) → Redis cache → SQLite
```

> **Uma única instância** é suficiente: a API é read-only e stateless, com Redis cacheando tudo por 1h. Se o container cair, o Docker reinicia em segundos. Economiza ~80–100 MB de RAM na VPS. Para escalar, basta adicionar `app-02` de volta ao compose e ao upstream do nginx.

### Directory Structure
- `src/controllers/` - Database controllers implementing `IController` interface
- `src/services/` - Redis connection and configuration
- `src/middlewares/` - Cache, IP detection, custom headers
- `src/utils/` - Bible reference parser and book name mappings
- `src/db/sqlite/` - SQLite databases (one per Bible translation: ARC, NVI, NTLH, KJA, KJF, ACF)

### Key Components
- **SqliteController** (`src/controllers/sqlite-controller.ts`): Main database controller, instantiated as singleton and passed to router
- **Cache middleware** (`src/middlewares/cache.ts`): Redis caching wrapper with 1-hour TTL, uses `cache:{originalUrl}` keys
- **Bible parser** (`src/utils/bible-parser.ts`): Parses Portuguese Bible references (e.g., "João 3:16", "Gn 1-3") into structured queries

### Database Schema (SQLite)
Each translation is a separate `.sqlite` file with tables: `book`, `verse`, `testament`, `metadata`. See `src/db/sqlite/schema.sql`.

## Environment Variables

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `HTTP_PORT` | `3333` | Server port |
| `NODE_ENV` | — | `development` ou `production` (afeta CORS) |
| `HOSTNAME` | IP detectado | Base URL para CORS |
| `CORS_ORIGINS` | `HOSTNAME:PORT` | Origins permitidas (separadas por vírgula) |
| `REDIS_HOST` | `localhost` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `REDIS_PASSWORD` | — | **Obrigatório em produção** — autenticação Redis |

Copie `.env.dev.example` para `.env` antes de rodar localmente.

## Testing

| Nível | O que testa | Mocks | Ferramentas |
|-------|-------------|-------|-------------|
| **Unit — utils** | Bible parser, book mappings, lógica pura | ❌ | Jest |
| **Integration** | Rotas HTTP end-to-end (SQLite real + Redis mockado) | Redis apenas | Jest + supertest |

Testes rodam no `docker build` (CI) — o Dockerfile executa `npm test` na stage builder.

## Security

Ver [SECURITY_AUDIT.md](./docs/SECURITY_AUDIT.md) para o audit completo.

Medidas em vigor:
- Rate limiting: 100 req/15min global, 20 req/15min em `/search`
- Redis autenticado via `REDIS_PASSWORD`
- Helmet + CSP via Nginx
- Body limit: 50kb
- Validação de input em todos os query params
- CORS restrito por `CORS_ORIGINS` (não `*` em produção)

Pending do audit: fixar versões de pacotes (remover `^`) e commitar `package-lock.json`.

## Structured Logging

Adicionar middleware de logging estruturado para todo request:
```ts
{ requestId: uuid(), method, path, status, durationMs, ip }
```
Nunca logar conteúdo de busca que possa conter PII. Use `requestId` gerado no início do request.

## Graceful Shutdown

Express deve capturar `SIGTERM` (enviado pelo Docker ao parar o container):
```ts
process.on('SIGTERM', async () => {
  server.close(async () => {
    await redisClient.quit()
    process.exit(0)
  })
})
```
O Dockerfile usa `CMD ["npx", "tsx", "src/index.ts"]` — garanta que o processo Express seja PID 1 (sem `sh -c`).

## Docker & Imagens

- Dockerfile: multi-stage (builder roda testes + cria índices SQLite; runner usa `USER node`)
- Nunca usar `:latest` em produção — tag com SHA do commit (`ghcr.io/killerbean/biblia-backend:<sha>`)
- `docker-compose.yaml` usa `:latest` apenas para dev/local — deploy no VPS via `deploy.sh` com tag SHA
- Manter 3 imagens no GHCR para rollback rápido

## API Documentation

Interactive docs available at `/docs` endpoint when server is running.
