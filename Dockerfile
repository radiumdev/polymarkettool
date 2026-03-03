# ── Build stage ──────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build

# ── Runtime stage ────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy built app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/bot ./bot
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Data directory (mount as volume for persistence)
RUN mkdir -p /app/data

EXPOSE 3000

# Start both Next.js server and bot
CMD ["sh", "-c", "node server.js & npx tsx bot/index.ts"]
