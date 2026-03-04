#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> Fetching latest commit info..."
COMMIT=$(curl -s 'https://api.github.com/repos/masolnada/markcards/commits/main')
HASH=$(echo "$COMMIT" | jq -r '.sha' | cut -c1-7)
DATE=$(echo "$COMMIT" | jq -r '.commit.committer.date' | sed 's/T.*//' | sed 's/-//g')
APP_VERSION="${DATE}-${HASH}"

echo "==> Deploying version $APP_VERSION..."
APP_VERSION=$APP_VERSION docker compose -f "$REPO_DIR/docker-compose.yml" \
  up -d --build --force-recreate --remove-orphans

echo ""
echo "Deployed $APP_VERSION."
