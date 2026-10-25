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

## Traduções e licenças

O catálogo canônico fica em `config/translations.json`. Uma tradução somente é
ingerida quando a fonte é um download oficial ou um arquivo entregue pelo titular,
e somente é publicada quando `status=published` e `allowPublicApi=true`.

`onbv-2007` usa o download USFM oficial da Biblica, sob CC BY-SA 4.0. ACF, ARC,
KJA, KJF, NTLH e NVI permanecem como `license-review`: os arquivos legados não são
expostos nas rotas v1 e não devem ser enviados ao S3 até existir licença documental.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | API info |
| GET | `/health` | Health check (SQLite + memory status) |
| GET | `/versions` | List available translations |
| GET | `/books` | List books (`?name=` filter) |
| GET | `/books/:bookId` | Book by ID |
| GET | `/books/:bookId/chapters` | Chapter count for a book |
| GET | `/books/testament/:testamentId` | Books by testament |
| GET | `/verses/:bookId` | All verses of a book |
| GET | `/verses/:bookId/:chapterId` | Verses by chapter (`?start=&end=` range) |
| GET | `/search?query=` | Search verses by text (max 200 chars) |
| GET | `/docs` | Swagger interactive docs |
| GET | `/terms` | Termos operacionais e contato para titulares |
| GET | `/v1/public/translations` | Catálogo publicado; requer `X-API-Key` |
| GET | `/v1/public/translations/:id/books` | Livros da tradução publicada |
| GET | `/v1/public/translations/:id/books/:book/chapters/:chapter` | Um capítulo por requisição |
| GET | `/v1/public/translations/:id/search?q=` | Busca FTS, limitada a 50 resultados |
| GET | `/v1/app/...` | Mesmos recursos para o BFF; requer Bearer service token |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `HTTP_PORT` | `3333` | Server port |
| `NODE_ENV` | — | `development` or `production` |
| `HOSTNAME` | auto-detected IP | Base URL for CORS |
| `CORS_ORIGINS` | — | Comma-separated absolute HTTP(S) origins; required in production |
| `REDIS_HOST` | `localhost` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `REDIS_PASSWORD` | — | Redis authentication password (required in production) |
| `PUBLIC_API_KEY_HASHES` | — | SHA-256 das chaves públicas, separados por vírgula |
| `APP_SERVICE_TOKEN` | — | Segredo compartilhado exclusivamente com o BFF web |
| `BIBLE_DATA_DIR` | `/data/bibles` | Diretório dos SQLite aprovados em runtime |
| `BIBLE_S3_BUCKET` | — | Bucket privado de fontes e SQLite versionados |
| `LEGAL_CONTACT_EMAIL` | — | Contato exibido em `/` e `/terms` |
| `ENABLE_LEGACY_API` | `false` | Ponte temporária para rotas antigas; não habilitar sem revisar as licenças |

## Development

```bash
npm install
npm run dev        # Hot reload via nodemon
npm test           # Run Jest tests
npm run swagger    # Regenerate Swagger docs
npm run lint       # ESLint
npm run typecheck  # TypeScript sem emitir arquivos
npm run build      # Gates locais + Swagger + integridade dos dados
npm run verify:translations
```

### Pipeline de uma tradução

```bash
# Gera e valida localmente; nunca faz scraping nem inventa uma fonte.
npm run translation:ingest -- \
  --translation onbv-2007 \
  --source /caminho/download-oficial.zip \
  --output /tmp/onbv-2007.sqlite

# Repete o processo e envia fonte, SQLite, manifesto e ponteiro current.json ao S3 privado.
npm run translation:ingest -- --translation onbv-2007 --upload
```

O upload usa chaves imutáveis por revisão e SSE-S3. O comando valida 66 livros,
integridade estrutural, textos vazios e gera FTS5 e SHA-256 antes de publicar o
ponteiro. API.Bible e APIs semelhantes não são fontes de ingestão.

Copy `.env.dev.example` to `.env` and adjust values before running.

## Deploy

Open a reviewed PR from `master` to `prod`; never push directly to `prod`.
After merge, the CI/CD pipeline (`.github/workflows/deploy.yml`) runs:

1. Runs tests
2. Generates Swagger docs (`npm run swagger`)
3. Builds and pushes Docker image to GHCR
4. Signs the immutable image and publishes a signed deployment manifest
5. The VPS puller verifies the manifest and applies `biblia-app`

**Compose files:**
- `docker-compose.yaml` — Development (no resource limits)
- `docker-compose.prod.yml` — Production (CPU/memory limits per container)

```bash
# Approved manual application on the VPS (after signed-manifest verification)
sudo vps-deploy biblia-app

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
- API keys são armazenadas somente como SHA-256; o BFF usa token separado
- respostas v1 carregam crédito, licença, link oficial e permissão de redistribuição
