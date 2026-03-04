#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> Starting markcards..."
docker compose -f "$REPO_DIR/docker-compose.yml" up -d

echo ""
echo "Stack started."
