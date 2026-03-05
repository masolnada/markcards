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
  sudo usermod -aG docker "$USER"
  NORMAL_USER=$(getent passwd 1000 | cut -d: -f1)
  if [ -n "$NORMAL_USER" ] && [ "$NORMAL_USER" != "$USER" ]; then
    sudo usermod -aG docker "$NORMAL_USER"
  fi

  echo "==> Enabling and starting Docker service..."
  sudo systemctl enable --now docker

  echo "==> Docker installed: $(docker --version)"
}

# ── Tailscale ─────────────────────────────────────────────────────────
install_tailscale() {
  if command -v tailscale &>/dev/null; then
    echo "==> Tailscale already installed: $(tailscale version | head -1)"
    return
  fi

  echo "==> Installing Tailscale..."
  curl -fsSL https://tailscale.com/install.sh | sh

  echo "==> Enabling Tailscale service..."
  sudo systemctl enable --now tailscaled

  if [ -n "${TAILSCALE_AUTHKEY:-}" ]; then
    echo "==> Joining Tailnet..."
    sudo tailscale up --authkey "$TAILSCALE_AUTHKEY" --accept-routes
  else
    echo "    ⚠️  TAILSCALE_AUTHKEY not set — skipping tailscale up"
  fi

  echo "==> Tailscale installed."
}

# ── Main ──────────────────────────────────────────────────────────────
echo "Markcards dependency installer"
echo "==============================="
echo ""

install_docker
install_tailscale

echo ""
echo "Installation complete!"
