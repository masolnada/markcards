FROM oven/bun:1 AS builder

RUN apt-get update && apt-get install -y --no-install-recommends git && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ARG APP_VERSION=dev
ENV APP_VERSION=$APP_VERSION

COPY package.json bun.lock ./
COPY apps/client/package.json ./apps/client/
COPY apps/server/package.json ./apps/server/
COPY apps/telegram-bot/package.json ./apps/telegram-bot/

RUN bun install --frozen-lockfile

COPY apps/client ./apps/client

RUN cd apps/client && bun run build

FROM oven/bun:1-slim AS runtime

WORKDIR /app

COPY --from=builder /app/apps/client/dist/client.js  ./public/client.js
COPY --from=builder /app/apps/client/dist/client.css ./public/client.css
COPY --from=builder /app/apps/client/public/index.html ./public/index.html
COPY apps/client/serve.ts ./serve.ts

EXPOSE 3001
CMD ["bun", "serve.ts"]
