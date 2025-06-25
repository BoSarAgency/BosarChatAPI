# Multi-stage build for BoSar API
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat curl openssl
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json* ./
RUN npm ci --only=production

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app

# Install all dependencies including dev dependencies for building
COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

# Generate Prisma client (skip during cross-platform builds, will be generated at runtime)
RUN if [ "$(uname -m)" = "x86_64" ]; then npx prisma generate; else echo "Skipping Prisma generation during cross-platform build"; fi

# Build the application
RUN npm run build

# Production image, copy all the files and run the app
FROM base AS runner
WORKDIR /app

# Install curl for health checks and OpenSSL for Prisma
RUN apk add --no-cache curl openssl

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

# Copy the built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma

# Generate Prisma client if not already generated (for cross-platform builds)
RUN if [ ! -d "node_modules/.prisma" ]; then npx prisma generate; fi

# Create uploads directory with proper permissions
RUN mkdir -p uploads/pdfs && chown -R nestjs:nodejs uploads

USER nestjs

EXPOSE 3001

ENV PORT=3001

CMD ["node", "dist/src/main"]
