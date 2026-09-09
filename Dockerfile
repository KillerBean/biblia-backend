# Stage 1: Dependencies and Build
FROM node:24-alpine@sha256:01743339035a5c3c11a373cd7c83aeab6ed1457b55da6a69e014a95ac4e4700b AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code and scripts
COPY . .

# Reproducible quality gates. Database initialization remains a separate step.
RUN npm run lint
RUN npm run typecheck
RUN npm test
RUN npm run verify:assets

# Gera documentação Swagger
RUN npx tsx src/swagger.ts

# OTIMIZAÇÃO: Cria os índices nos bancos SQLite durante o build
RUN npx tsx scripts/init-db.ts

# Stage 2: Production Runner
FROM node:24-alpine@sha256:01743339035a5c3c11a373cd7c83aeab6ed1457b55da6a69e014a95ac4e4700b AS runner

# Upgrade all Alpine packages to patch OS-level CVEs until base image is updated
# (zlib CVE-2026-22184, openssl CVE-2026-31789/28387-90, musl CVE-2026-40200)
RUN apk upgrade --no-cache

# Keep the runtime CLI on a patched release. npm 11.19.1 includes fixed
# tar, pacote, brace-expansion, ip-address and sigstore dependencies.
RUN npm install -g npm@11.19.1

WORKDIR /app

# Set environment variables
ENV NODE_ENV=production
ENV HOSTNAME=http://localhost
ENV HTTP_PORT=3333

# Create a non-root user
USER node

# Copy dependencies
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/package*.json ./

# Copy source code, assets and the already OPTIMIZED databases
COPY --from=builder --chown=node:node /app/src ./src
COPY --from=builder --chown=node:node /app/images ./images
COPY --from=builder --chown=node:node /app/tsconfig.json ./

# Expose the port
EXPOSE 3333

# Start the application
CMD ["npx", "tsx", "src/index.ts"]
