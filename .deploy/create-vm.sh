#!/usr/bin/env bash
set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────
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
if [ -n "$SSH_PUB_KEY" ]; then
  SSH_KEY_FILE=$(mktemp)
  echo "$SSH_PUB_KEY" > "$SSH_KEY_FILE"
  qm set "$VMID" --sshkeys "$SSH_KEY_FILE"
  rm -f "$SSH_KEY_FILE"
  echo "    SSH key loaded from SSH_PUB_KEY"
else
  echo "    ⚠️  No SSH_PUB_KEY provided — VM will not be accessible"
  echo "    Usage: SSH_PUB_KEY=\"\$(cat ~/.ssh/id_rsa.pub)\" bash create-vm.sh"
  exit 1
fi

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

runcmd:
  - git clone $REPO_URL /opt/markcards
  - chown -R $VM_USER:$VM_USER /opt/markcards
  - chmod +x /opt/markcards/.deploy/install.sh /opt/markcards/.deploy/init.sh
  - /opt/markcards/.deploy/install.sh
  - /opt/markcards/.deploy/init.sh
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
echo "  1. Install git and jq"
echo "  2. Clone the markcards repo to /opt/markcards"
echo "  3. Run .deploy/install.sh (Docker)"
echo "  4. Run .deploy/init.sh (.env setup)"
echo ""
echo "Next steps after VM boots:"
echo "  1. SSH into the VM: ssh $VM_USER@$VM_NAME.local"
echo "  2. Edit /opt/markcards/.env with your credentials"
echo "  3. Start: /opt/markcards/.deploy/start.sh"
