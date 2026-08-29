# AGENTS.md

## Commands

```bash
npm run dev          # Dev server (nodemon + tsx, 2.5s delay)
npm test             # Jest (ESM mode, requires NODE_OPTIONS=--experimental-vm-modules)
npm run swagger      # Regenerate Swagger docs (writes swagger-output.json)
npm start            # Production (tsx, no hot reload)
npx tsc --noEmit     # Type check only (no emit)
```

**Docker:**
```bash
./launch.sh -a       # Full redeploy (down + up --build)
./launch.sh -u       # Build and start
./launch.sh -d       # Stop and remove
```

## CI Pipeline Order (push to master)
1. `npm ci` → 2. `npx tsx src/swagger.ts` → 3. `npx tsc --noEmit` → 4. `npm test` → 5. `npm audit --audit-level=high` → 6. Docker build + Trivy scan

## Deploy
Push to `prod` branch → tests → Docker build → GHCR push (`ghcr.io/killerbean/biblia-backend:<sha>`) → SSH to VPS → `deploy.sh`. Never use `:latest` in production.

## Architecture
```
Client → Nginx → Express (app) → Redis cache (1h TTL) → SQLite
```

Single instance is sufficient — API is read-only and stateless. SQLite DBs live in `src/db/sqlite/` (6 translations: ARC, NVI, NTLH, KJA, KJF, ACF). Each `.sqlite` file has tables: `book`, `verse`, `testament`, `metadata`.

**Entry point:** `src/index.ts` — top-level await creates `SqliteController` singleton, then mounts router.

**Key files:**
- `src/controllers/sqlite-controller.ts` — main DB controller (singleton via `create()`)
- `src/router.ts` — route definitions, receives controller + searchLimiter
- `src/middlewares/cache.ts` — Redis cache with `cache:{originalUrl}` keys
- `src/utils/bible-parser.ts` — parses Portuguese references ("João 3:16", "Gn 1-3")
- `src/services/redis-service.ts` — Redis singleton client

## Testing

```bash
npm test             # Runs all tests
```

- **Unit:** `src/utils/bible-parser.test.ts` — pure logic, no mocks
- **Integration:** `src/router.test.ts` — supertest + SQLite mock + Redis mock via `jest.unstable_mockModule()` (required for ESM)
- **Setup:** `src/setupTests.ts` polyfills `TextEncoder`/`TextDecoder`
- **Jest config:** ESM mode with `ts-jest`, `moduleNameMapper` strips `.js` extensions from imports
- Mocks live in `src/__mocks__/` and `src/services/__mocks__/`

## Environment

Copy `.env.dev.example` to `.env` for local dev. `REDIS_PASSWORD` is **required** in production (app exits with error if missing).

## Build quirks

- **ESM modules:** `package.json` has `"type": "module"`, tsconfig uses `"module": "nodenext"`. Import paths must include `.ts` extension.
- **Docker build** runs tests, generates Swagger, then runs `scripts/init-db.ts` to create SQLite indexes before copying to runner stage.
- **SQLite files** are tracked via Git LFS (`lfs: true` in CI checkout).
- `launch.sh` deletes `package-lock.json` and `node_modules` before running docker compose.

## Security

- Rate limit: 100 req/15min global, 20 req/15min on `/search`, skipped for `/health`
- Body limit: 50kb
- Helmet + CSP via Nginx
- CORS restricted by `CORS_ORIGINS` (not `*` in production)
- `trust proxy` enabled for Nginx
