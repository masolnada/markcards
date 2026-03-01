---
description: Deploy the markcards service to the homelab server
disable-model-invocation: true
allowed-tools: Bash(ssh *)
---

Deploy the markcards service to the homelab server. The Docker image is built directly from the GitHub source, so a rebuild is required to pick up new commits.

Steps:

1. Rebuild the image from the latest GitHub source and restart the container:
```bash
ssh -i ~/.ssh/id_infra_v2 ubuntu@homelab "cd /opt/homelab && sudo docker compose -f learning/docker-compose.yml build --no-cache markcards && sudo docker compose -f learning/docker-compose.yml up -d markcards"
```

2. Verify the container is running:
```bash
ssh -i ~/.ssh/id_infra_v2 ubuntu@homelab "sudo docker ps --filter name=markcards --format '{{.Names}}\t{{.Status}}'"
```
Expected: `markcards	Up N seconds`

If verification fails, fetch the logs to diagnose:
```bash
ssh -i ~/.ssh/id_infra_v2 ubuntu@homelab "sudo docker logs markcards --tail 50"
```

Important: always push changes to the `main` branch before running this skill, otherwise the build will pull stale code.
