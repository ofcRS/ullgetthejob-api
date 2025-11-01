# Build stage
FROM oven/bun:1-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json bun.lock ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy application code
COPY tsconfig.json drizzle.config.ts ./
COPY src ./src

# Runtime stage
FROM oven/bun:1-alpine

# Install runtime dependencies (for pdf-parse and other native modules)
RUN apk add --no-cache \
    dumb-init \
    wget \
    curl

# bun:1-alpine already has 'bun' user with uid/gid 1000
# Just use that user instead of creating a new one

WORKDIR /app

# Copy from builder
COPY --from=builder --chown=bun:bun /app/node_modules ./node_modules
COPY --from=builder --chown=bun:bun /app/package.json ./
COPY --chown=bun:bun tsconfig.json drizzle.config.ts ./
COPY --chown=bun:bun src ./src

# Switch to bun user
USER bun

EXPOSE 3000

ENV NODE_ENV=production

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

CMD ["bun", "run", "start"]

