#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# Load .env if present
if [ -f "$REPO_DIR/.env" ]; then
  set -o allexport
  # shellcheck disable=SC1091
  source "$REPO_DIR/.env"
  set +o allexport
fi

# ── Docker ────────────────────────────────────────────────────────────
install_docker() {
  if command -v docker &>/dev/null; then
    echo "==> Docker already installed: $(docker --version)"
    return
  fi

  echo "==> Installing Docker via official convenience script..."
  curl -fsSL https://get.docker.com | sh

  echo "==> Adding users to docker group..."
  CURRENT_USER=$(whoami)
  sudo usermod -aG docker "$CURRENT_USER"
  NORMAL_USER=$(getent passwd 1000 | cut -d: -f1)
  if [ -n "$NORMAL_USER" ] && [ "$NORMAL_USER" != "$CURRENT_USER" ]; then
    sudo usermod -aG docker "$NORMAL_USER"
  fi

  echo "==> Enabling and starting Docker service..."
  sudo systemctl enable --now docker

  echo "==> Docker installed: $(docker --version)"
}

# ── Main ──────────────────────────────────────────────────────────────
echo "Markcards dependency installer"
echo "==============================="
echo ""

install_docker

echo ""
echo "Installation complete!"
