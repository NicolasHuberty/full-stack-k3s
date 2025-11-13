# Multi-stage Dockerfile for Next.js Docuralis application

# Stage 1: Dependencies
FROM oven/bun:1-alpine AS deps
WORKDIR /app

# Install dependencies needed for native modules
RUN apk add --no-cache libc6-compat python3 make g++

# Copy package files
COPY package.json bun.lock* ./
COPY prisma ./prisma/

# Install dependencies
RUN bun install --frozen-lockfile

# Generate Prisma Client
RUN bunx prisma generate

# Stage 2: Builder
FROM oven/bun:1-alpine AS builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set environment variables for build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
# Dummy environment variables for build-time validation (not used, just required to be defined)
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
ENV OPENAI_API_KEY="sk-dummy-key-for-build-only"

# Build the application
RUN bun run build

# Stage 3: Runner
FROM oven/bun:1-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Install tesseract for OCR (needed by worker)
RUN apk add --no-cache tesseract-ocr tesseract-ocr-data-eng

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files from builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Set correct permissions
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD bun -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["bun", "run", "server.js"]

# Stage 4: Worker
FROM oven/bun:1-alpine AS worker
WORKDIR /app

ENV NODE_ENV=production

# Install tesseract for OCR and dependencies for native modules
RUN apk add --no-cache tesseract-ocr tesseract-ocr-data-eng libc6-compat python3 make g++

# Copy package files and source first
COPY package.json bun.lock* ./
COPY prisma ./prisma/

# Install ALL dependencies fresh (don't rely on builder stage)
RUN bun install --frozen-lockfile

# Generate Prisma Client
RUN bunx prisma generate

# Now copy application source
COPY src ./src
COPY tsconfig.json ./tsconfig.json

# Create non-root user and set permissions
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 worker && \
    mkdir -p /app/logs && \
    chown -R worker:nodejs /app

USER worker

# Health check for worker (check if process is running)
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD pgrep -f "document-processor" || exit 1

CMD ["bun", "run", "src/workers/document-processor.ts"]
