FROM oven/bun:1 AS builder

WORKDIR /app

ARG APP_VERSION=dev
ENV APP_VERSION=$APP_VERSION

# Install deps (workspace-aware)
COPY package.json bun.lock ./
COPY apps/markcards/package.json ./apps/markcards/
COPY packages/ui/package.json ./packages/ui/
RUN bun install --frozen-lockfile

COPY . .
RUN cd apps/markcards && bun run build

FROM oven/bun:1-slim AS runtime

RUN groupadd --gid 1001 markcards \
    && useradd --uid 1001 --gid markcards --shell /bin/sh --create-home markcards

WORKDIR /app

COPY --from=builder --chown=markcards:markcards /app/node_modules          ./node_modules
COPY --from=builder --chown=markcards:markcards /app/apps/markcards/dist   ./dist
COPY --from=builder --chown=markcards:markcards /app/apps/markcards/public ./public

RUN mkdir -p /data /decks && chown markcards:markcards /data /decks
VOLUME ["/data", "/decks"]

ENV DB_PATH=/data/markcards.db \
    DECKS_DIR=/decks \
    PORT=3000

EXPOSE 3000
USER markcards
CMD ["bun", "dist/server.mjs"]
