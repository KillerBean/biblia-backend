# Plano de Ação — Segurança & Robustez (2026-03-21)

**Revisado por:** Claude Sonnet 4.6 (com análise de código real)
**Data:** 2026-03-21
**Próxima revisão:** 2026-06-21

---

## STATUS ATUAL — O QUE JÁ ESTÁ FEITO

> Itens marcados como pendentes no plano anterior que já estão implementados.

| Item | Local | Observação |
|------|-------|-----------|
| Graceful shutdown (SIGTERM) | `src/index.ts:99-104` | ✅ Implementado — mas falta timeout para in-flight |
| Logging estruturado (requestId, method, path, status, durationMs, ip) | `src/middlewares/logger.ts` | ✅ Implementado |
| Error handler global | `src/index.ts:89-92` | ✅ Implementado — mas não inclui `requestId` na resposta |
| Rate limit global + `/search` restrito | `src/index.ts:29-41` | ✅ Implementado |
| Body size limit 50kb | `src/index.ts:67` | ✅ Implementado |
| Redis com autenticação | `src/services/redis-service.ts` | ✅ Implementado |
| Helmet + desabilita X-Powered-By | `src/index.ts:26,65` | ✅ Implementado |
| CORS restrito por `CORS_ORIGINS` | `src/index.ts:53-60` | ✅ Implementado |
| Input validation em `/search` (max 200 chars) | `src/router.ts:121-124` | ✅ Implementado |
| Input validation em bookId/chapterId (NaN) | `src/router.ts:25,44,59` | ✅ Implementado |
| SQLite OPEN_READONLY | `src/controllers/sqlite-controller.ts:22-25` | ✅ Implementado |

---

## 1. BUGS DE SEGURANÇA CRÍTICOS (DESCOBERTOS NA REVISÃO DE CÓDIGO)

> Problemas novos, não listados no plano anterior — descobertos analisando o código real.

### 1.1 Conteúdo de Busca Armazenado no Redis ⚠️ CRÍTICO
**Risco:** Violação de privacidade — o middleware de cache usa `cache:${req.originalUrl}` como chave, então `/search?query=palavra` fica salvo no Redis por 1h. Contradiz a política do CLAUDE.md ("Nunca logar conteúdo de busca").

**Arquivo:** `src/middlewares/cache.ts:15`, `src/router.ts:114`

- [ ] Excluir rota `/search` do cache middleware (passar `next()` diretamente se path começa com `/search`)
- [ ] Ou: hash SHA-256 do query antes de usar como chave (`cache:/search:${sha256(query)}`)
- [ ] Adicionar teste que garante que texto de busca não é persistido no Redis
- [ ] Documentar política de cache por rota

**Implementação sugerida em `cache.ts`:**
```ts
// Não cachear /search (privacidade — query param contém PII implícito)
if (req.path.startsWith('/search')) return next();
```

---

### 1.2 Cache Key Injection / Pollution ⚠️ ALTO
**Risco:** Chave de cache é `req.originalUrl` sem sanitização. URLs com caracteres especiais podem collidir ou poluir o namespace Redis.

**Arquivo:** `src/middlewares/cache.ts:15`

- [ ] Sanitizar/normalizar a chave: remover trailing slashes, normalizar encoding
- [ ] Adicionar tamanho máximo para chave de cache (ex: 500 chars) — rejeitar se exceder
- [ ] Considerar hash da URL como chave para evitar caracteres inválidos
- [ ] Adicionar prefixo de versão da API na chave (ex: `cache:v1:${url}`) para facilitar invalidação em deploys

---

### 1.3 Graceful Shutdown sem Timeout para In-Flight Requests ⚠️ ALTO
**Risco:** `server.close()` para de aceitar novas conexões mas aguarda indefinidamente as existentes. Se uma query SQLite travar, o processo nunca sai — Docker vai force-kill após timeout.

**Arquivo:** `src/index.ts:99-104`

- [ ] Adicionar timeout de 30s após `server.close()` — force exit se ultrapassar
- [ ] Adicionar handler para `SIGINT` (além de `SIGTERM`) — Ctrl+C em dev não está tratado
- [ ] Fechar explicitamente a conexão SQLite no shutdown (atualmente só fecha Redis)

**Implementação sugerida:**
```ts
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

async function gracefulShutdown() {
    const timeout = setTimeout(() => process.exit(1), 30_000);
    server.close(async () => {
        clearTimeout(timeout);
        await redisClient.quit();
        process.exit(0);
    });
}
```

---

### 1.4 Respostas de Erro sem `requestId` ⚠️ MÉDIO
**Risco:** O error handler global retorna `'Internal Server Error'` sem `requestId` — impossível correlacionar o erro relatado pelo cliente com os logs do servidor.

**Arquivo:** `src/index.ts:89-92`

- [ ] Retornar JSON com `requestId` nos erros: `{ error: "Internal Server Error", requestId: res.locals.requestId }`
- [ ] Garantir que `loggerMiddleware` é aplicado antes de qualquer rota (já está, mas validar ordem)
- [ ] Não vazar `err.stack` para o cliente — apenas logar internamente

---

### 1.5 Input Validation Incompleta ⚠️ MÉDIO

**a) `/books?name=` sem limite de tamanho**
- `name` query param aceita qualquer tamanho — 1MB query causaria LIKE lento no SQLite
- [ ] Adicionar validação: `name` máximo 100 chars
- [ ] Arquivo: `src/router.ts:17`

**b) `start`/`end` sem upper bound**
- Validados para NaN e `>= 1` mas sem máximo — `start=999999999` desperdiça recursos
- [ ] Limitar: `start` e `end` máximo 176 (maior capítulo da Bíblia — Salmos 119)
- [ ] Arquivo: `src/router.ts:96-103`

**c) `bookId`/`testamentId`/`chapterId` sem upper bound**
- `bookId` pode ser qualquer número positivo — `bookId=9999999` faz query que retorna vazio mas desnecessária
- [ ] Limitar: `bookId` máximo 66, `testamentId` máximo 2, `chapterId` máximo 150
- [ ] Arquivo: `src/router.ts`

---

### 1.6 SQLite Hardcoded — Multi-versão Não Funciona ⚠️ MÉDIO
**Risco:** `SqliteController` abre apenas `ARC.sqlite` hardcoded, mas `getVersionList()` lista todos os arquivos `.sqlite`. As outras versões (NVI, NTLH, KJA, KJF, ACF) não são acessíveis via API — funcionalidade prometida mas não entregue.

**Arquivo:** `src/controllers/sqlite-controller.ts:22-23`

- [ ] Definir comportamento: uma versão por instância (via env `BIBLE_VERSION=ARC`) ou multi-versão com abertura dinâmica
- [ ] Se multi-versão: abrir todas as DBs no `init()` e roteá-las por query param `?version=NVI`
- [ ] Se single-version: remover `getVersionList()` ou fazê-la retornar apenas a versão ativa
- [ ] Adicionar validação: versão solicitada deve estar na lista de DBs disponíveis (whitelist)

---

### 1.7 Sem Timeout em Queries SQLite ⚠️ MÉDIO
**Risco:** Uma query lenta (ex: `searchByText` com palavra muito comum como "e") pode bloquear o event loop por vários segundos — amplificado em carga alta.

**Arquivo:** `src/controllers/db-class-sqlite.ts:114-136`

- [ ] Configurar `PRAGMA busy_timeout = 5000` (5s) na abertura da DB
- [ ] `searchByText` já tem `LIMIT 100` — manter, mas adicionar timeout via `Promise.race`
- [ ] Documentar: "palavras com <3 caracteres rejeitadas" — adicionar validação no router

---

## 2. CI/CD — QUEBRADO E INSEGURO (URGENTE)

### 2.1 CI Nunca Executa ⚠️ CRÍTICO
**Risco:** Workflow configurado para `branches: [ main ]` mas o branch default é `master` — nenhum PR aciona o CI.

**Arquivo:** `.github/workflows/ci.yml:5`

- [ ] Corrigir: `branches: [ master ]` ou adicionar ambos `[ main, master ]`
- [ ] Validar se há proteção de branch no GitHub (branch protection rules)

---

### 2.2 CI Usa `npm install` em vez de `npm ci` ⚠️ ALTO
**Risco:** `npm install` modifica o `package-lock.json` se houver divergência — builds não são reproduzíveis. `npm ci` é determinístico e falha se lock não bate.

**Arquivo:** `.github/workflows/ci.yml:21`

- [ ] Substituir `npm install` por `npm ci`
- [ ] Garantir que `package-lock.json` está commitado e atualizado

---

### 2.3 GitHub Actions sem Pin de SHA ⚠️ ALTO
**Risco:** `actions/checkout@v3` e `actions/setup-node@v3` podem ser comprometidos se a tag for movida (supply chain attack).

**Arquivo:** `.github/workflows/ci.yml:6,10`

- [ ] Usar SHA fixo: `actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683` (v4)
- [ ] Usar SHA fixo: `actions/setup-node@39370e3970a6d050c480ffad4ff0ed4d3fdee5af` (v4)
- [ ] Adicionar Dependabot para GitHub Actions

---

### 2.4 CI sem Verificações de Segurança ⚠️ ALTO
**Arquivo:** `.github/workflows/ci.yml`

- [ ] Adicionar `npm audit --audit-level=high` — falhar se vulns high/critical
- [ ] Adicionar type check: `npx tsc --noEmit`
- [ ] Adicionar lint (se configurar ESLint)
- [ ] Adicionar scan de secrets: `trufflesecurity/trufflehog` ou `gitleaks`
- [ ] Adicionar scan de imagem Docker: `aquasecurity/trivy-action`
- [ ] Executar CI em push para master, não apenas em PRs

**CI pipeline target:**
```yaml
on:
  push:
    branches: [ master ]
  pull_request:
    branches: [ master ]

steps:
  - npm ci
  - npx tsc --noEmit
  - npm test
  - npm audit --audit-level=high
  - docker build (com trivy scan)
```

---

## 3. DEPENDÊNCIAS & VERSIONING

### 3.1 Fixar Versões de Pacotes
**Objetivo:** Builds reproduzíveis — remover `^` e `~` do `package.json`
**Impacto:** Alto

**Estado atual (deps com `^`):** `body-parser`, `cors`, `express`, `express-rate-limit`, `ioredis`, `sqlite3`, `serve-favicon`, `@types/cors`, `@types/express`, `@types/jest`, `@types/supertest`, `jest`, `nodemon`, `supertest`, `tsx`

- [ ] Rodar `npm audit` e documentar findings antes de fixar versões
- [ ] Atualizar todas as deps para versão mais recente estável
- [ ] Remover `^` e `~` de todas as entradas em `package.json`
- [ ] Commitar `package-lock.json` (atualmente não está no repo — ver B2 do audit)
- [ ] Usar `npm ci` em todos os ambientes (CI, Docker, produção)
- [ ] Documentar política: security patches aplicados imediatamente; minor/major revisados trimestralmente

**Atenção:** `express ^4.22.1` — Express 4 tem histórico de vulnerabilidades. Avaliar migração para Express 5 (estável desde 2024).

---

### 3.2 Auditoria de Dependências
- [ ] Rodar `npm audit` e triagem de findings
- [ ] Avaliar deprecação de `body-parser` (já incluído em Express 4.16+ via `express.json()`)
- [ ] Avaliar `swagger-autogen` + `swagger-ui-express` — versões recentes?
- [ ] Adicionar `npm audit` ao CI (já listado em 2.4)

---

## 4. HTTPS & INFRAESTRUTURA

### 4.1 HTTPS/TLS (Depende do VPS)
**Objetivo:** Forçar comunicação criptografada
**Impacto:** Crítico

- [ ] Verificar se TLS termination já ocorre upstream (proxy externo na `vps-network`)
- [ ] Se não: provisionar cert via Let's Encrypt (`certbot --nginx`)
- [ ] Configurar nginx: redirect HTTP 301 → HTTPS
- [ ] Habilitar HSTS: `add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;`
- [ ] Testar: `ssllabs.com` — target: A+ rating
- [ ] Configurar renovação automática: `certbot renew` em cron ou systemd timer
- [ ] Usar TLS 1.2+ apenas (desabilitar TLS 1.0/1.1)
- [ ] Configurar `ssl_session_cache` e `ssl_session_timeout` no nginx para performance

---

### 4.2 Redis — Configurações Adicionais de Segurança
**Arquivo:** `src/services/redis-service.ts`

- [ ] Configurar `connectTimeout` (padrão é infinito no ioredis) — limitar a 3s
- [ ] Revisar `retryStrategy`: retries ilimitados com backoff podem acumular requisições em fila durante Redis down — adicionar `maxRetriesPerRequest` mais baixo ou circuit breaker
- [ ] Configurar `lazyConnect: true` para falha explícita no startup se Redis não disponível
- [ ] Habilitar TLS para conexão Redis se não estiver na mesma rede Docker (produção)

---

## 5. OBSERVABILIDADE

### 5.1 Logging — Melhorias no Existente
**Status:** Implementado (`src/middlewares/logger.ts`). Melhorias pendentes:

- [ ] Adicionar `requestId` como header de resposta (`res.setHeader('X-Request-ID', requestId)`) — cliente pode reportar para debugging
- [ ] Logar eventos críticos separadamente:
  - [ ] Rate limit excedido — capturar via `handler` personalizado no `rateLimit()`
  - [ ] Redis connection error — já logado em `console.warn`, estruturar como JSON
  - [ ] SQLite query error — capturar no catch dos controllers
- [ ] Não logar query params em `/search` (privacidade) — `req.path` sem `req.originalUrl` para essa rota
- [ ] Configurar rotação de logs se usando logs locais: `logrotate` ou winston com transport
- [ ] Definir retenção: mínimo 30 dias para auditoria

**Nota de privacidade:** O logger atual usa `req.path` (sem query params) — OK. Mas verificar que nenhum middleware loga `req.query` ou `req.originalUrl` em produção.

---

### 5.2 Health Check Endpoint
- [ ] Criar `GET /health` retornando:
  ```json
  {
    "status": "ok",
    "uptime": 3600,
    "redis": "connected",
    "sqlite": "accessible",
    "memoryMB": 45
  }
  ```
- [ ] Redis check: `redisClient.ping()` com timeout de 1s
- [ ] SQLite check: `SELECT 1` com timeout de 500ms
- [ ] Retornar `503` se qualquer dependência falhar
- [ ] Excluir `/health` do rate limiter global
- [ ] Excluir `/health` do logger (muito ruído de load balancers)
- [ ] Configurar Docker healthcheck: `HEALTHCHECK --interval=30s --timeout=3s CMD curl -f http://localhost:3333/health || exit 1`
- [ ] Não cachear `/health` no Redis

---

### 5.3 Métricas (Fase 2)
- [ ] Adicionar `prom-client` para expor `/metrics` em formato Prometheus
- [ ] Métricas prioritárias: req/s por endpoint, latência p50/p95/p99, cache hit ratio, erro rate
- [ ] Configurar alertas: error rate >5%, latência p99 >2s, Redis down
- [ ] Proteger `/metrics` com IP whitelist (apenas scraper Prometheus acessa)

---

## 6. ERROR HANDLING — REFINAMENTO

### 6.1 Error Handler com requestId
**Arquivo:** `src/index.ts:89-92`

- [ ] Incluir `requestId` na resposta de erro:
  ```ts
  res.status(500).json({ error: 'Internal Server Error', requestId: res.locals.requestId })
  ```
- [ ] Estruturar log de erro como JSON (atualmente é `console.error(err.stack)` — texto plano)
- [ ] Em produção (`NODE_ENV=production`): nunca incluir `err.message` na resposta
- [ ] Adicionar handler para erros assíncronos não capturados:
  ```ts
  process.on('unhandledRejection', (reason) => { /* log + alert */ });
  process.on('uncaughtException', (err) => { /* log + graceful shutdown */ });
  ```

---

## 7. TESTES

### 7.1 Gaps de Cobertura Identificados
**Atual:** `src/utils/` e `src/router.ts` com testes. Faltam:

- [ ] `src/middlewares/cache.ts` — testar: cache hit, cache miss, exclusão de `/search`, keys inválidas
- [ ] `src/middlewares/logger.ts` — testar: requestId gerado, campos corretos, sem query params em `/search`
- [ ] `src/controllers/sqlite-controller.ts` — testar: versão ativa, fallback se DB não encontrada
- [ ] `src/services/redis-service.ts` — testar: comportamento quando Redis down (falha graceful)
- [ ] Graceful shutdown — testar: SIGTERM fecha conexões, SIGINT também
- [ ] Rate limiting — testar: 20 req/15min em `/search`, 100 req/15min global

### 7.2 Testes de Segurança Específicos
- [ ] Input fuzzing para `/search?query=`: strings vazias, null bytes, emojis, regex especial, SQL injection payloads
- [ ] `/books?name=`: string com 1000 chars, string com SQL injection, LIKE wildcards `%_%_%`
- [ ] Boundary testing: `bookId=0`, `bookId=-1`, `bookId=67` (inexistente), `bookId=9999999`
- [ ] Cache key collision: duas URLs diferentes resultando na mesma chave

### 7.3 Cobertura Meta
- [ ] Target: >80% de cobertura de linhas
- [ ] Configurar `jest --coverage` no CI com threshold
- [ ] Falhar CI se cobertura cair abaixo do threshold

---

## 8. DEPLOYMENT & CONTAINER

### 8.1 Dependências de Versão Fixas no Docker
- [ ] Usar imagem base com SHA no `Dockerfile`: `node:20-alpine@sha256:...`
- [ ] Usar versão SHA no `docker-compose.prod.yml`: `ghcr.io/killerbean/biblia-backend:<sha>` (já documentado no CLAUDE.md)
- [ ] Scan de imagem no CI com Trivy (ver 2.4)
- [ ] Manter 3 imagens no GHCR — implementar script de limpeza para além de 3

### 8.2 Secrets Management
- [ ] `REDIS_PASSWORD` obrigatório em produção — adicionar validação no startup:
  ```ts
  if (process.env.NODE_ENV === 'production' && !process.env.REDIS_PASSWORD) {
      console.error('FATAL: REDIS_PASSWORD required in production');
      process.exit(1);
  }
  ```
- [ ] `.env.example` atualizado com todas as variáveis (sem valores)
- [ ] Rotacionar `REDIS_PASSWORD` trimestralmente
- [ ] Nunca commitar `.env` (já no `.gitignore` ✅ — manter vigilância)

### 8.3 Network Security
- [ ] Validar: Redis exposto apenas na docker network interna (não na porta do host)
- [ ] Validar: apenas portas 80/443 abertas no firewall do VPS
- [ ] Configurar nginx rate limiting na camada nginx também (complementar ao Express)

---

## 9. COMPLIANCE & DOCUMENTAÇÃO

### 9.1 SECURITY.md
- [ ] Criar `SECURITY.md` com:
  - Política de disclosure responsável
  - Como reportar vulnerabilidade (email, PGP key se aplicável)
  - SLA de resposta (ex: 48h acknowledge, 7 dias para fix crítico)

### 9.2 Atualizar SECURITY_AUDIT.md
- [ ] Adicionar findings desta revisão (itens 1.1–1.7 acima)
- [ ] Marcar B2 e B3 como resolvidos após fixar `package-lock.json` e versões

### 9.3 Runbook
- [ ] Criar `docs/RUNBOOK.md` com:
  - Como rotacionar `REDIS_PASSWORD`
  - Como fazer rollback de imagem Docker
  - Resposta a Redis down
  - Resposta a spike de error rate
  - Como investigar suspeita de breach (logs, Redis keys, IP blocks)

---

## 10. ROADMAP — PRIORIZAÇÃO REVISADA

### Fase 1 — CRÍTICO (Semana 1)

| # | Item | Esforço |
|---|------|---------|
| 1.1 | Cache poisoning: excluir `/search` do cache | 30min |
| 2.1 | Corrigir CI — branch `master` | 5min |
| 2.2 | CI: `npm ci` + commitar `package-lock.json` | 1h |
| 1.3 | Graceful shutdown: timeout 30s + SIGINT | 30min |
| 4.1 | HTTPS/TLS no VPS | Depende de infra |

**Critério de sucesso:** CI funciona, builds reproduzíveis, busca não vaza para Redis.

### Fase 2 — ALTO (Semana 2)

| # | Item | Esforço |
|---|------|---------|
| 1.4 | Error responses com requestId | 20min |
| 1.5 | Input validation completa (max lengths, upper bounds) | 1h |
| 2.3 | GitHub Actions com SHA pins | 30min |
| 2.4 | CI: npm audit + tsc + trivy | 2h |
| 3.1 | Fixar versões de pacotes (remover `^`) | 2h |
| 5.2 | Health check endpoint `/health` | 2h |
| 6.1 | unhandledRejection + uncaughtException handlers | 30min |

**Critério de sucesso:** CI bloqueia deploys com vulns, health check funciona, CI completo.

### Fase 3 — MÉDIO (Semanas 3-4)

| # | Item | Esforço |
|---|------|---------|
| 1.2 | Cache key sanitization | 1h |
| 1.6 | Definir e implementar multi-versão SQLite | 3-5h |
| 1.7 | Timeout em queries SQLite | 1h |
| 4.2 | Redis: connectTimeout + circuit breaker | 1h |
| 7.1 | Testes de middlewares e controllers | 4-8h |
| 7.2 | Testes de segurança / fuzzing | 4h |
| 8.2 | Validação de REDIS_PASSWORD no startup | 30min |

**Critério de sucesso:** >70% cobertura, queries SQLite com timeout, multi-versão funcionando ou decisão documentada.

### Fase 4 — BAIXO (Ongoing)

| # | Item |
|---|------|
| 5.3 | Métricas Prometheus + alertas |
| 9.1 | SECURITY.md |
| 9.3 | Runbook |
| 8.3 | Network security audit |
| 5.1 | Log rotation + retenção 30 dias |
| 3.2 | Auditoria trimestral de dependências |

---

## Questões Pendentes

1. **Multi-versão SQLite:** Uma versão por instância (env `BIBLE_VERSION`) ou roteamento dinâmico por query param? Afeta arquitetura e cache.
2. **HTTPS:** TLS termination já ocorre upstream na `vps-network`, ou precisa provisionar certs diretamente no nginx?
3. **Redis em produção:** Está na mesma docker network do Express (sem TLS na conexão), ou em host separado (precisa TLS)?
4. **Log central:** ELK, Loki/Grafana, ou rotação local com logrotate? Afeta `5.1`.
5. **Branch protection:** GitHub tem branch protection em `master`? CI precisa ser obrigatório antes de merge?
6. **Métricas:** Há infraestrutura Prometheus/Grafana no VPS, ou isso é futuro?
7. **`/search` cache:** Decisão — hash SHA-256 do query (mantém cache mas preserva privacidade) ou sem cache? Impacto de performance?

---

**Gerado em:** 2026-03-21 (revisado por análise de código real)
**Próxima revisão:** 2026-06-21
