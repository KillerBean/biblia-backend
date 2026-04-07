# Stage 1: Dependencies and Build
FROM node:24-alpine@sha256:01743339035a5c3c11a373cd7c83aeab6ed1457b55da6a69e014a95ac4e4700b AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code and scripts
COPY . .

# Run tests
RUN npm test

# Gera documentação Swagger
RUN npx tsx src/swagger.ts

# OTIMIZAÇÃO: Cria os índices nos bancos SQLite durante o build
RUN npx tsx scripts/init-db.ts

# Stage 2: Production Runner
FROM node:24-alpine@sha256:01743339035a5c3c11a373cd7c83aeab6ed1457b55da6a69e014a95ac4e4700b AS runner

# Upgrade zlib to patch CVE-2026-22184 (HIGH) until base image is updated
RUN apk upgrade --no-cache zlib

# Upgrade npm to patch CVE-2026-27903/27904 (minimatch), CVE-2026-29786/31802 (tar)
# Then patch CVE-2026-33671 (picomatch 4.0.3→4.0.4) inside npm's bundled tinyglobby,
# which npm 11.12.1 still bundles with picomatch 4.0.3
RUN npm install -g npm@11.12.1 \
 && cd /usr/local/lib/node_modules/npm/node_modules/tinyglobby \
 && npm install --no-save picomatch@4.0.4

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
