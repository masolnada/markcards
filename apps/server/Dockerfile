FROM oven/bun:1 AS builder

RUN apt-get update && apt-get install -y --no-install-recommends git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ARG APP_VERSION=dev
ENV APP_VERSION=$APP_VERSION

# Copy all workspace manifests so bun install resolves the full lockfile
COPY package.json bun.lock ./
COPY apps/client/package.json ./apps/client/
COPY apps/server/package.json ./apps/server/
COPY apps/telegram-bot/package.json ./apps/telegram-bot/
COPY packages/types/package.json ./packages/types/
COPY packages/ui/package.json ./packages/ui/

RUN bun install --frozen-lockfile

COPY apps/server ./apps/server

RUN cd apps/server && bun run build

# ── runtime ──────────────────────────────────────────────────────────────────
FROM oven/bun:1-slim AS runtime

WORKDIR /app

COPY package.json bun.lock ./
COPY apps/client/package.json ./apps/client/
COPY apps/server/package.json ./apps/server/
COPY apps/telegram-bot/package.json ./apps/telegram-bot/
COPY packages/types/package.json ./packages/types/
COPY packages/ui/package.json ./packages/ui/

RUN bun install --production --frozen-lockfile

COPY --from=builder /app/apps/server/dist/server.mjs ./apps/server/dist/server.mjs

ENV DB_PATH=/data/markcards.db \
    DECKS_DIR=/decks \
    PORT=3000

EXPOSE 3000
CMD ["bun", "apps/server/dist/server.mjs"]
