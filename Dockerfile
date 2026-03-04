# Note: This Dockerfile uses Node instead of Bun because the server's CPU lacks
# AVX support, causing Bun's JavaScriptCore engine to segfault during builds.
# Track the upstream Bun issue: https://github.com/oven-sh/bun/issues/9423
FROM node:20-slim AS builder

WORKDIR /app

ARG APP_VERSION=dev
ENV APP_VERSION=$APP_VERSION

COPY apps/markcards/package.json ./
RUN npm install

COPY apps/markcards/ ./
RUN node build.mjs
RUN npm prune --omit=dev

FROM node:20-slim AS runtime

RUN groupadd --gid 1001 markcards \
    && useradd --uid 1001 --gid markcards --shell /bin/sh --create-home markcards

WORKDIR /app

COPY --from=builder --chown=markcards:markcards /app/node_modules ./node_modules
COPY --from=builder --chown=markcards:markcards /app/dist         ./dist
COPY --from=builder --chown=markcards:markcards /app/public       ./public

RUN mkdir -p /data /decks && chown markcards:markcards /data /decks
VOLUME ["/data", "/decks"]

ENV DB_PATH=/data/markcards.db \
    DECKS_DIR=/decks \
    PORT=3000

EXPOSE 3000
USER markcards
CMD ["node", "dist/server.mjs"]
