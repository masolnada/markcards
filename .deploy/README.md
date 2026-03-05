# Deployment

Markcards runs on a Proxmox VM provisioned via cloud-init. One Tailscale node is registered per deployment (`{VM_NAME}-gw`) as a Caddy sidecar container.

## Architecture

```
Tailscale network
└── {VM_NAME}-gw  ←  Caddy (HTTPS)
                        ├── markcards.{DOMAIN}        → client:3001
                        └── markcards.{DOMAIN}/api/*  → server:3000
```

TLS certificates are obtained via Cloudflare DNS-01 challenge — no public ports needed. The app is only accessible from within the tailnet.

## Scripts

| Script | Purpose |
|--------|---------|
| `create-vm.sh` | Create and boot a Proxmox VM (runs `install.sh` via cloud-init) |
| `install.sh` | Install Docker on the VM |
| `start.sh` | Build and start the Docker Compose stack |
| `clean.sh` | Tear down containers and volumes |

## First deploy

### 1. Prepare credentials

Copy `deploy.env.example` to `deploy.env` and fill in the values (never committed):

```bash
cp .deploy/deploy.env.example .deploy/deploy.env
```

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
| `DOMAIN` | **yes** | Base domain for wildcard cert (e.g. `dev.example.com`) |
| `ACME_EMAIL` | **yes** | Email for Let's Encrypt |
| `CLOUDFLARE_API_TOKEN` | **yes** | Cloudflare token for DNS-01 challenge |
| `TAILSCALE_AUTHKEY` | **yes** | Reusable/ephemeral Tailscale auth key for the gateway container |
| `GITHUB_REPO` | no | GitHub deck source repo |
| `GITHUB_TOKEN` | no | GitHub token for private deck repos |
| `DECKS_DIR` | no | Host path for deck files (default: /opt/markcards/decks) |

> `DOMAIN` is the base domain — Caddy serves `markcards.{DOMAIN}` using a wildcard cert for `*.{DOMAIN}`.

### 2. Create the VM

Run from the repo root (copies scripts to pve and executes remotely):

```bash
scp -i ~/.ssh/id_infra_v2 .deploy/create-vm.sh .deploy/install.sh .deploy/deploy.env root@pve:/tmp/
ssh -i ~/.ssh/id_infra_v2 root@pve 'set -a; source /tmp/deploy.env; set +a; bash /tmp/create-vm.sh'
```

Cloud-init will: install `qemu-guest-agent` + `git`, clone the repo to `/opt/markcards`, write `.env`, and run `install.sh` (Docker).

### 3. Monitor provisioning

Via serial console (before SSH is up):

```bash
ssh -t -i ~/.ssh/id_infra_v2 root@pve 'qm terminal {VMID}'
# Ctrl+O to exit
```

Once cloud-init finishes, get the VM IP:

```bash
ssh -i ~/.ssh/id_infra_v2 root@pve 'qm guest cmd {VMID} network-get-interfaces'
```

### 4. Start the app

SSH into the VM and run `start.sh`:

```bash
ssh -o IdentitiesOnly=yes ubuntu@{VM_IP}
cd /opt/markcards && .deploy/start.sh
```

Once Tailscale is connected, you can SSH by hostname instead:

```bash
ssh ubuntu@{VM_NAME}
```

### 5. Add DNS record

In Cloudflare, create an A record pointing `*.{DOMAIN}` (or `markcards.{DOMAIN}`) to the gateway's Tailscale IP:

```bash
docker exec markcards-tailscale tailscale ip
```

The app will be available at `https://markcards.{DOMAIN}` for anyone on the tailnet.

## Redeploying

To deploy a new version:

```bash
ssh ubuntu@{VM_NAME} 'cd /opt/markcards && git pull && .deploy/start.sh'
```

## Destroying the VM

```bash
ssh -i ~/.ssh/id_infra_v2 root@pve 'qm stop {VMID} && qm destroy {VMID} --purge'
```
