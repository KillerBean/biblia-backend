# Stage 1: Dependencies and Build
FROM node:24-alpine@sha256:01743339035a5c3c11a373cd7c83aeab6ed1457b55da6a69e014a95ac4e4700b AS builder

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.33.4 --activate

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code and scripts
COPY . .

# Reproducible quality gates. Database initialization remains a separate step.
RUN pnpm run lint
RUN pnpm run typecheck
RUN pnpm test
RUN pnpm run verify:assets

# Gera documentação Swagger
RUN pnpm exec tsx src/swagger.ts

# OTIMIZAÇÃO: Cria os índices nos bancos SQLite durante o build
RUN pnpm exec tsx scripts/init-db.ts

# Stage 2: Production Runner
FROM node:24-alpine@sha256:01743339035a5c3c11a373cd7c83aeab6ed1457b55da6a69e014a95ac4e4700b AS runner

# Upgrade all Alpine packages to patch OS-level CVEs until base image is updated
# (zlib CVE-2026-22184, openssl CVE-2026-31789/28387-90, musl CVE-2026-40200)
RUN apk upgrade --no-cache

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.33.4 --activate

# Set environment variables
ENV NODE_ENV=production
ENV HOSTNAME=http://localhost
ENV HTTP_PORT=3333

# Create a non-root user
USER node

# Copy dependencies
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/package.json /app/pnpm-lock.yaml ./

# Copy source code, assets and the already OPTIMIZED databases
COPY --from=builder --chown=node:node /app/src ./src
COPY --from=builder --chown=node:node /app/images ./images
COPY --from=builder --chown=node:node /app/tsconfig.json ./

# Expose the port
EXPOSE 3333

# Start the application
CMD ["pnpm", "exec", "tsx", "src/index.ts"]
