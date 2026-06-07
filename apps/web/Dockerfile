# Stage 1: Install dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy lock files and root config
COPY package.json package-lock.json tsconfig.json ./
# Copy workspace packages package.json files first to cache dependencies install
COPY apps/web/package.json ./apps/web/package.json
COPY packages/core-logic/package.json ./packages/core-logic/package.json

RUN npm ci

# Stage 2: Rebuild the source code only when needed
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/packages/core-logic/node_modules ./packages/core-logic/node_modules
COPY . .

# Disable telemetry during the build
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# Stage 3: Runner stage
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy public directory and static assets
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static

# Leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/web/server.js"]
