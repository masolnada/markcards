FROM oven/bun:1 AS builder

RUN apt-get update && apt-get install -y --no-install-recommends git && rm -rf /var/lib/apt/lists/*

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

# Copy sources needed for the client build
COPY packages/types ./packages/types
COPY packages/ui ./packages/ui
COPY apps/client ./apps/client

RUN cd apps/client && bun run build

FROM oven/bun:1-slim AS runtime

WORKDIR /app

COPY --from=builder /app/apps/client/dist ./dist
COPY apps/client/serve.ts ./serve.ts

EXPOSE 3001
CMD ["bun", "serve.ts"]
