# Stage 1: Dependencies and Build
FROM node:24-alpine@sha256:01743339035a5c3c11a373cd7c83aeab6ed1457b55da6a69e014a95ac4e4700b AS builder

WORKDIR /app

# pnpm pinned via packageManager (corepack).
COPY package.json pnpm-lock.yaml ./
RUN corepack enable pnpm && corepack install

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code and scripts
COPY . .

# Reproducible quality gates. Database initialization remains a separate step.
RUN pnpm run lint
RUN pnpm run typecheck
RUN pnpm test
RUN pnpm run verify:assets
RUN pnpm run verify:translations

# Gera documentação Swagger
RUN pnpm exec tsx src/swagger.ts

# OTIMIZAÇÃO: Cria os índices nos bancos SQLite durante o build
RUN pnpm exec tsx scripts/init-db.ts

# Keep only runtime dependencies (tsx included) in the final image.
RUN pnpm prune --prod

# Stage 2: Production Runner
FROM node:24-alpine@sha256:01743339035a5c3c11a373cd7c83aeab6ed1457b55da6a69e014a95ac4e4700b AS runner

# Upgrade all Alpine packages to patch OS-level CVEs until base image is updated
# (zlib CVE-2026-22184, openssl CVE-2026-31789/28387-90, musl CVE-2026-40200)
RUN apk upgrade --no-cache

# The service runs with Node directly. Remove the bundled package managers so
# their transitive CVEs are not shipped in the runtime image.
RUN rm -rf /usr/local/lib/node_modules/npm \
    /usr/local/lib/node_modules/corepack \
    /opt/yarn-v* \
    && rm -f /usr/local/bin/npm /usr/local/bin/npx \
    /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg

WORKDIR /app

# Set environment variables
ENV NODE_ENV=production
ENV HOSTNAME=http://localhost
ENV HTTP_PORT=3333

# Create the private runtime artifact directory before dropping privileges.
RUN mkdir -p /data/bibles && chown node:node /data/bibles
USER node

# Copy dependencies
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/package.json /app/pnpm-lock.yaml ./

# Copy source code, assets and the already OPTIMIZED databases
COPY --from=builder --chown=node:node /app/src ./src
COPY --from=builder --chown=node:node /app/scripts ./scripts
COPY --from=builder --chown=node:node /app/config ./config
COPY --from=builder --chown=node:node /app/images ./images
COPY --from=builder --chown=node:node /app/tsconfig.json ./

# Expose the port
EXPOSE 3333

# Start the application
CMD ["node", "--import", "tsx", "scripts/start-production.ts"]
