FROM oven/bun:1-slim

RUN groupadd --gid 1001 markcards \
    && useradd --uid 1001 --gid markcards --shell /bin/sh --create-home markcards

WORKDIR /app

COPY package.json ./
RUN bun install --production

COPY src ./src
COPY tsconfig.json ./

USER markcards
CMD ["bun", "src/index.ts"]
