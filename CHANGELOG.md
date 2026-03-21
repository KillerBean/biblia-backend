# Changelog

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/) e este projeto adere a [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [Current] - 2026-03-21

### Added
- **docker-compose.prod.yml**: Nova configuração de compose para ambiente de produção com limite de recursos (memória, CPU)
- **Swagger generation no Docker build**: `npm run swagger` agora é executado automaticamente durante `docker build`

### Changed
- **Serviço Docker renomeado**: `app` → `biblia-app` em docker-compose.yaml
- **Upstream Nginx atualizado**: Upstream agora referencia `biblia-app:3333` (antes `app:3333`)
- **src/swagger.ts**: Removido `await import('./index.ts')` que iniciava o servidor; agora executa `process.exit(0)` após gerar docs

### Fixed
- **Swagger no Docker build**: Swagger é agora gerado sem iniciar a aplicação Express
- **CI/CD**: Swagger output é gerado e incluído na imagem Docker automaticamente

---

## Release Notes por Commit

### fed2d90 - chore: add docker-compose.prod.yml for production deployment
- Novo arquivo `docker-compose.prod.yml` com configuração de produção
- Serviço `biblia-app` com limits: 128m memória, 0.3 CPU
- Redis com limit: 80m memória, 0.1 CPU
- Nginx com limit: 32m memória, 0.1 CPU
- Networks: `nginx_net` (bridge) + `vps-network` (external)

### 1865c40 - fix: remove import do servidor no swagger.ts, add process.exit(0)
- Removido `await import('./index.ts')` que iniciava o Express server
- Adicionado `process.exit(0)` para encerrar após gerar Swagger

### 8a64b96 - fix: gera swagger-output.json no Docker build
- Adicionado step no Dockerfile: `RUN npx tsx src/swagger.ts`
- Garantir que swagger-output.json seja criado durante build

### fec1321 - chore: atualiza upstream nginx para biblia-app
- Upstream Nginx: `server biblia-app:3333` (antes `server app:3333`)
- Alinhado com renomeação do serviço Docker

### 2fbe6c3 - chore: renomeia serviço app para biblia-app no docker-compose
- docker-compose.yaml: `app` → `biblia-app`
- Melhor clareza do nome do serviço na arquitetura

---

## Notas de Arquitetura

### Diferença entre docker-compose.yaml e docker-compose.prod.yml

**docker-compose.yaml** (desenvolvimento):
- Image: `ghcr.io/killerbean/biblia-backend:latest`
- Sem limits explícitos de recurso
- Ideal para desenvolvimento local

**docker-compose.prod.yml** (produção):
- Image: `ghcr.io/killerbean/biblia-backend:latest` (será substituída por SHA do commit via deploy.sh)
- Limits: `biblia-app` (128m RAM, 0.3 CPU), `nginx` (32m RAM, 0.1 CPU), `redis` (80m RAM, 0.1 CPU)
- Otimizado para VPS com recursos limitados

### Fluxo de Build e Deploy

1. **Local**: `npm run swagger` gera `swagger-output.json`
2. **Docker build**: `RUN npx tsx src/swagger.ts` gera novamente (CI/CD)
3. **Runtime**: Swagger docs disponível em `/docs`

---

## Como usar

### Desenvolvimento
```bash
docker-compose up -d
./launch.sh -u  # Build e start
```

### Produção (VPS)
```bash
# Via deploy.sh (executa via SSH em VPS)
./deploy.sh

# Ou manualmente
docker-compose -f docker-compose.prod.yml up -d
```

### Gerar Swagger docs
```bash
npm run swagger      # Local
# ou durante docker build (automático)
```

---

## Pendências (do CLAUDE.md)

- [ ] Fixar versões de pacotes (remover `^` do package.json)
- [ ] Commitar `package-lock.json`
- [ ] Adicionar middleware de logging estruturado (requestId, method, path, status, duration, ip)
- [ ] Validar SIGTERM graceful shutdown em produção
