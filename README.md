# Biblia Backend

REST API serving Bible text in Portuguese with multiple translations. Built with Express.js + TypeScript (ESM), SQLite for Bible content, and Redis for caching.

## Stack

- **Runtime:** Node.js 22, TypeScript (ESM)
- **Framework:** Express.js
- **Database:** SQLite (one file per translation)
- **Cache:** Redis
- **Reverse proxy:** Nginx
- **Container:** Docker + GitHub Container Registry (`ghcr.io/killerbean/biblia-backend`)

## Architecture

```
Client → Nginx → biblia-app → Redis → SQLite
```

> Uma única instância é suficiente: a API é read-only, stateless, e Redis cacheia por 1h. Se cair, Docker reinicia em segundos (~80-100 MB RAM). Para escalar, adicione `biblia-app-02` ao compose e upstream nginx.

## Translations

| ID   | Name                               |
|------|------------------------------------|
| ARC  | Almeida Revista e Corrigida        |
| NVI  | Nova Versão Internacional          |
| NTLH | Nova Tradução na Linguagem de Hoje |
| KJA  | King James Atualizada              |
| KJF  | King James Fiel                    |
| ACF  | Almeida Corrigida Fiel             |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | API info |
| GET | `/versions` | List available translations |
| GET | `/books` | List books (`?name=` filter) |
| GET | `/books/:bookId` | Book by ID |
| GET | `/books/:bookId/chapters` | Chapter count for a book |
| GET | `/books/testament/:testamentId` | Books by testament |
| GET | `/verses/:bookId` | All verses of a book |
| GET | `/verses/:bookId/:chapterId` | Verses by chapter (`?start=&end=` range) |
| GET | `/search?query=` | Search verses by text (max 200 chars) |
| GET | `/docs` | Swagger interactive docs |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `HTTP_PORT` | `3333` | Server port |
| `NODE_ENV` | — | `development` or `production` |
| `HOSTNAME` | auto-detected IP | Base URL for CORS |
| `CORS_ORIGINS` | `HOSTNAME:PORT` | Comma-separated allowed origins |
| `REDIS_HOST` | `localhost` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `REDIS_PASSWORD` | — | Redis authentication password (required in production) |

## Development

```bash
npm install
npm run dev        # Hot reload via nodemon
npm test           # Run Jest tests
npm run swagger    # Regenerate Swagger docs
```

Copy `.env.dev.example` to `.env` and adjust values before running.

## Deploy

The CI/CD pipeline (`.github/workflows/deploy.yml`) runs on pushes to the `prod` branch:

1. Runs tests
2. Generates Swagger docs (`npm run swagger`)
3. Builds and pushes Docker image to GHCR
4. SSHs into VPS and runs `deploy.sh`

**Compose files:**
- `docker-compose.yaml` — Development (no resource limits)
- `docker-compose.prod.yml` — Production (CPU/memory limits per container)

```bash
# Manual deploy on VPS
./deploy.sh

# Local Docker (development)
./launch.sh -a   # Full redeploy (down + up)
./launch.sh -u   # Build and start
./launch.sh -d   # Stop and remove

# Production (if deploying locally)
docker-compose -f docker-compose.prod.yml up -d
```

## Security

See [SECURITY_AUDIT.md](./SECURITY_AUDIT.md) for the full audit report.

Key measures in place:
- Rate limiting: 100 req/15min globally, 20 req/15min on `/search`
- Redis password authentication via `REDIS_PASSWORD`
- Helmet security headers + CSP via Nginx
- Request body limited to 50kb
- Input validation on all query parameters
