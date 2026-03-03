# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:24-slim AS builder

# Build tools required to compile better-sqlite3's native binding
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ARG APP_VERSION=dev
ENV APP_VERSION=$APP_VERSION

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Drop dev dependencies before copying to the runtime stage
RUN npm prune --omit=dev

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM node:24-slim AS runtime

RUN groupadd --gid 1001 markcards \
    && useradd --uid 1001 --gid markcards --shell /bin/sh --create-home markcards

WORKDIR /app

COPY --from=builder --chown=markcards:markcards /app/dist        ./dist
COPY --from=builder --chown=markcards:markcards /app/public      ./public
COPY --from=builder --chown=markcards:markcards /app/node_modules ./node_modules
COPY --from=builder --chown=markcards:markcards /app/package.json ./package.json

# /data  → SQLite database (mount a named volume or bind-mount here)
# /decks → local deck files (used when GITHUB_REPO is not set)
RUN mkdir -p /data /decks && chown markcards:markcards /data /decks
VOLUME ["/data", "/decks"]

ENV DB_PATH=/data/markcards.db \
    DECKS_DIR=/decks \
    PORT=3000

EXPOSE 3000

USER markcards

CMD ["node", "dist/server.mjs"]
