# Build context: repo root (docker build -f apps/web/Dockerfile .)
FROM node:20-alpine AS deps
WORKDIR /repo

COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/
COPY apps/web/prisma ./apps/web/prisma/

RUN npm ci --workspace=apps/web
RUN cd apps/web && npx prisma generate

FROM node:20-alpine AS builder
WORKDIR /repo
COPY --from=deps /repo/node_modules ./node_modules
COPY . .
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" npm run build --workspace=apps/web

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# With outputFileTracingRoot at repo root, standalone output is at:
#   apps/web/.next/standalone/ with entry at apps/web/.next/standalone/apps/web/server.js
COPY --from=builder /repo/apps/web/public ./apps/web/public
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /repo/apps/web/prisma ./apps/web/prisma
# Copy full node_modules so prisma CLI has wasm files, engines, etc.
COPY --from=deps --chown=nextjs:nodejs /repo/node_modules ./node_modules

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

WORKDIR /app/apps/web
CMD ["sh", "-c", "/app/node_modules/.bin/prisma db push --accept-data-loss; node server.js"]
