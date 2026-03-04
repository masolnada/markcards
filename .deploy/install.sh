#!/usr/bin/env bash
set -euo pipefail

# ── Docker ────────────────────────────────────────────────────────────
install_docker() {
  if command -v docker &>/dev/null; then
    echo "==> Docker already installed: $(docker --version)"
    return
  fi

  echo "==> Installing Docker via official convenience script..."
  curl -fsSL https://get.docker.com | sh

  echo "==> Adding users to docker group..."
  sudo usermod -aG docker "$USER"
  NORMAL_USER=$(getent passwd 1000 | cut -d: -f1)
  if [ -n "$NORMAL_USER" ] && [ "$NORMAL_USER" != "$USER" ]; then
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
echo ""
echo "Next steps:"
echo "  1. Log out and back in for docker group membership to take effect"
echo "  2. Run: .deploy/init.sh"
