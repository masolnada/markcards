#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "This will stop and remove all markcards containers, images, and volumes."
read -rp "Are you sure? (y/N) " confirm
[[ "$confirm" =~ ^[Yy]$ ]] || exit 0

docker compose -f "$REPO_DIR/docker-compose.yml" down -v --rmi all --remove-orphans

echo "Done."
