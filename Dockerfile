# syntax=docker/dockerfile:1
# The directive above enables BuildKit, required for --mount=type=cache below.

FROM oven/bun:1 AS builder

WORKDIR /app

ARG APP_VERSION=dev
ENV APP_VERSION=$APP_VERSION

# Copy only the manifests first so Docker can cache the install layer
# independently of source changes. The lockfile ensures reproducible installs.
COPY package.json bun.lock ./
COPY apps/markcards/package.json ./apps/markcards/
COPY packages/ui/package.json ./packages/ui/

# --production skips devDependencies (vitest, vite, rollup, typescript, @types/*,
# supertest). Only runtime deps + build tools (esbuild, tailwindcss) are installed,
# which are declared as regular dependencies in apps/markcards/package.json.
#
# --mount=type=cache persists bun's download cache (~/.bun/install/cache) across
# Docker builds. Without it, every build re-downloads all packages from the registry,
# which is the main cause of high peak RAM usage during CI builds.
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile --production

COPY . .
RUN cd apps/markcards && bun run build

# ── Runtime image ─────────────────────────────────────────────────────────────
# Use the slim variant to keep the final image small.
FROM oven/bun:1-slim AS runtime

RUN groupadd --gid 1001 markcards \
    && useradd --uid 1001 --gid markcards --shell /bin/sh --create-home markcards

WORKDIR /app

# node_modules from the builder already contains only production packages.
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
