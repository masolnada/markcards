#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"

APP_VERSION=$(git -C "$REPO_DIR" log -1 --format=%cd-%h --date=format:%Y%m%d 2>/dev/null || echo "dev")

echo "==> Starting markcards $APP_VERSION..."
APP_VERSION=$APP_VERSION docker compose -f "$REPO_DIR/docker-compose.yml" \
  up -d --build --force-recreate --remove-orphans

echo ""
echo "Started $APP_VERSION."
