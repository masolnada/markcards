#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> Creating .env from .env.example..."
if [ ! -f "$REPO_DIR/.env" ]; then
  cp "$REPO_DIR/.env.example" "$REPO_DIR/.env"
  echo "    Created .env"
else
  echo "    .env already exists, skipping"
fi

echo ""
echo "Initialization complete!"
echo ""
echo "Next steps:"
echo "  1. Edit .env with your credentials (DOMAIN, CLOUDFLARE_API_TOKEN, TAILSCALE_AUTHKEY, etc.)"
echo "  2. Start the stack: .deploy/start.sh"
