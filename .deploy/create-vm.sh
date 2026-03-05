#!/usr/bin/env bash
set -euo pipefail

# ── VM Configuration ───────────────────────────────────────────────────
VMID=${VMID:-300}
VM_NAME=${VM_NAME:-markcards}
CORES=${CORES:-2}
MEMORY=${MEMORY:-2048}
DISK_SIZE=${DISK_SIZE:-16G}
STORAGE=${STORAGE:-local-lvm}
BRIDGE=${BRIDGE:-vmbr0}
VLAN_TAG=${VLAN_TAG:-20}
SSH_PUB_KEY=${SSH_PUB_KEY:-}
VM_USER=${VM_USER:-ubuntu}
CLOUD_IMAGE_URL="https://cloud-images.ubuntu.com/noble/current/noble-server-cloudimg-amd64.img"
CLOUD_IMAGE="/var/lib/vz/template/iso/ubuntu-24.04-cloudimg-amd64.img"
REPO_URL=${REPO_URL:-https://github.com/masolnada/markcards.git}

# ── App Configuration (.env) ───────────────────────────────────────────
DOMAIN=${DOMAIN:-}
ACME_EMAIL=${ACME_EMAIL:-}
CLOUDFLARE_API_TOKEN=${CLOUDFLARE_API_TOKEN:-}
TAILSCALE_AUTHKEY=${TAILSCALE_AUTHKEY:-}
GITHUB_REPO=${GITHUB_REPO:-}
GITHUB_TOKEN=${GITHUB_TOKEN:-}
DECKS_DIR=${DECKS_DIR:-/decks}

# ── Validate required vars ─────────────────────────────────────────────
if [ -z "$SSH_PUB_KEY" ]; then
  echo "    ⚠️  No SSH_PUB_KEY provided — VM will not be accessible"
  echo "    Usage: SSH_PUB_KEY=\"\$(cat ~/.ssh/id_infra_v2.pub)\" bash create-vm.sh"
  exit 1
fi

missing=()
[ -z "$DOMAIN" ]                && missing+=("DOMAIN")
[ -z "$ACME_EMAIL" ]            && missing+=("ACME_EMAIL")
[ -z "$CLOUDFLARE_API_TOKEN" ]  && missing+=("CLOUDFLARE_API_TOKEN")
[ -z "$TAILSCALE_AUTHKEY" ]     && missing+=("TAILSCALE_AUTHKEY")
if [ ${#missing[@]} -gt 0 ]; then
  echo "⚠️  Missing required env vars: ${missing[*]}"
  exit 1
fi

# ── Download cloud image ──────────────────────────────────────────────
if [ ! -f "$CLOUD_IMAGE" ]; then
  echo "==> Downloading Ubuntu 24.04 cloud image..."
  wget -O "$CLOUD_IMAGE" "$CLOUD_IMAGE_URL"
else
  echo "==> Cloud image already exists, skipping download"
fi

# ── Create VM ─────────────────────────────────────────────────────────
echo "==> Creating VM $VMID ($VM_NAME)..."
qm create "$VMID" \
  --name "$VM_NAME" \
  --ostype l26 \
  --cpu host \
  --cores "$CORES" \
  --memory "$MEMORY" \
  --net0 "virtio,bridge=$BRIDGE,tag=$VLAN_TAG" \
  --agent enabled=1 \
  --onboot 1 \
  --scsihw virtio-scsi-single

# ── Disk setup ────────────────────────────────────────────────────────
echo "==> Importing cloud image as disk..."
qm set "$VMID" --scsi0 "$STORAGE:0,import-from=$CLOUD_IMAGE"
qm disk resize "$VMID" scsi0 "$DISK_SIZE"

# ── Cloud-init ────────────────────────────────────────────────────────
echo "==> Configuring cloud-init..."
qm set "$VMID" --ide2 "$STORAGE:cloudinit"
qm set "$VMID" --boot order=scsi0
qm set "$VMID" --serial0 socket --vga std
qm set "$VMID" --ipconfig0 ip=dhcp
qm set "$VMID" --ciuser "$VM_USER"

# ── SSH key setup ─────────────────────────────────────────────────────
SSH_KEY_FILE=$(mktemp)
echo "$SSH_PUB_KEY" > "$SSH_KEY_FILE"
qm set "$VMID" --sshkeys "$SSH_KEY_FILE"
rm -f "$SSH_KEY_FILE"
echo "    SSH key loaded from SSH_PUB_KEY"

# ── Cloud-init user data (post-boot provisioning) ─────────────────────
SNIPPET_DIR="/var/lib/vz/snippets"
SNIPPET_FILE="$SNIPPET_DIR/markcards-cloud-init.yml"
mkdir -p "$SNIPPET_DIR"

cat > "$SNIPPET_FILE" <<EOF
#cloud-config
ssh_pwauth: false
package_update: true
packages:
  - git
  - jq

write_files:
  - path: /opt/markcards/.env
    permissions: '0600'
    content: |
      DOMAIN=$DOMAIN
      ACME_EMAIL=$ACME_EMAIL
      CLOUDFLARE_API_TOKEN=$CLOUDFLARE_API_TOKEN
      TAILSCALE_AUTHKEY=$TAILSCALE_AUTHKEY
      GITHUB_REPO=$GITHUB_REPO
      GITHUB_TOKEN=$GITHUB_TOKEN
      DECKS_DIR=$DECKS_DIR

runcmd:
  - git clone $REPO_URL /opt/markcards-repo
  - cp /opt/markcards/.env /opt/markcards-repo/.env
  - rm -rf /opt/markcards
  - mv /opt/markcards-repo /opt/markcards
  - chown -R $VM_USER:$VM_USER /opt/markcards
  - chmod +x /opt/markcards/.deploy/install.sh /opt/markcards/.deploy/start.sh
  - /opt/markcards/.deploy/install.sh
  - /opt/markcards/.deploy/start.sh
EOF

qm set "$VMID" --cicustom "vendor=local:snippets/markcards-cloud-init.yml"

# ── Start VM ──────────────────────────────────────────────────────────
echo "==> Starting VM $VMID..."
qm start "$VMID"

echo ""
echo "✅ VM $VMID ($VM_NAME) created and started!"
echo ""
echo "  VLAN:     $VLAN_TAG"
echo "  User:     $VM_USER"
echo "  Host:     $VM_NAME.local"
echo "  Auth:     SSH key only (password disabled)"
echo ""
echo "Cloud-init will automatically:"
echo "  1. Install git, jq and Docker"
echo "  2. Clone the repo to /opt/markcards"
echo "  3. Write .env with provided credentials"
echo "  4. Run .deploy/start.sh"
echo ""
echo "Monitor progress: ssh $VM_USER@$VM_NAME.local 'sudo cloud-init status --wait'"
