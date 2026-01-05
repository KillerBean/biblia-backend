# Stage 1: Dependencies and Build
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code and scripts
COPY . .

# Run tests
RUN npm test

# OTIMIZAÇÃO: Cria os índices nos bancos SQLite durante o build
RUN npx tsx scripts/init-db.ts

# Stage 2: Production Runner
FROM node:22-alpine AS runner

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
