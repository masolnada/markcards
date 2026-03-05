# Deployment

Markcards runs on a Proxmox VM provisioned via cloud-init. One Tailscale node is registered per deployment (`{VM_NAME}-gw`) as a Caddy sidecar container.

## Scripts

| Script | Purpose |
|--------|---------|
| `create-vm.sh` | Create and boot a Proxmox VM |
| `install.sh` | Install Docker on the VM |
| `start.sh` | Build and start the Docker Compose stack |
| `clean.sh` | Tear down containers and volumes |

`create-vm.sh` calls `install.sh` and `start.sh` automatically via cloud-init on first boot.

## Deploying a new VM

1. Copy `deploy.env.example` to `deploy.env` and fill in the values (never committed).
2. Copy the script and env to the Proxmox host and run:

```bash
scp -i ~/.ssh/id_infra_v2 .deploy/create-vm.sh .deploy/deploy.env root@pve:/tmp/
ssh -i ~/.ssh/id_infra_v2 root@pve 'set -a; source /tmp/deploy.env; set +a; bash /tmp/create-vm.sh'
```

3. Monitor cloud-init progress (attach to serial console before SSH is up):

```bash
ssh -t -i ~/.ssh/id_infra_v2 root@pve 'qm terminal {VMID}'
```

Or once SSH is available:

```bash
ssh -i ~/.ssh/id_infra_v2 ubuntu@{VM_NAME}.local 'tail -f /var/log/cloud-init-output.log'
```

## deploy.env variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VMID` | no | Proxmox VM ID (default: 300) |
| `VM_NAME` | no | VM and Tailscale node name prefix (default: markcards) |
| `CORES` | no | vCPU count (default: 2) |
| `MEMORY` | no | RAM in MB (default: 2048) |
| `DISK_SIZE` | no | Disk size (default: 16G) |
| `STORAGE` | no | Proxmox storage pool (default: local-lvm) |
| `BRIDGE` | no | Network bridge (default: vmbr0) |
| `VLAN_TAG` | no | VLAN tag (default: 20) |
| `SSH_PUB_KEY` | **yes** | Public key for VM SSH access |
| `DOMAIN` | **yes** | Domain served by Caddy (e.g. markcards.example.com) |
| `ACME_EMAIL` | **yes** | Email for Let's Encrypt |
| `CLOUDFLARE_API_TOKEN` | **yes** | Cloudflare token for DNS-01 challenge |
| `TAILSCALE_AUTHKEY` | **yes** | Reusable/ephemeral Tailscale auth key for the gateway container |
| `GITHUB_REPO` | no | GitHub deck source repo |
| `GITHUB_TOKEN` | no | GitHub token for private deck repos |
| `DECKS_DIR` | no | Host path for deck files (default: /opt/markcards/decks) |

## Architecture

```
Tailscale network
└── {VM_NAME}-gw  ←  Caddy (HTTPS) → server:3000 / client:3001
```

TLS certificates are obtained via Cloudflare DNS-01 challenge, so no public ports are needed. The app is only accessible from within the tailnet.
