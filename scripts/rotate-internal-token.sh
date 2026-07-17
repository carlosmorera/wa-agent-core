#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
umask 077

INSTANCE_ID="$(sed -n 's/^INSTANCE_ID=//p' .env | head -1)"
INSTANCE_ID="${INSTANCE_ID:-local}"
ROTATION_FILE="secrets/rotation.local.json"
TOKEN="$(openssl rand -hex 32)"
trap 'rm -f "$ROTATION_FILE"' EXIT
printf '{\n  "secrets": {\n    "wa-agent-core/%s/internal-api-token": "%s"\n  }\n}\n' "$INSTANCE_ID" "$TOKEN" > "$ROTATION_FILE"
chmod 600 "$ROTATION_FILE"

docker compose --profile tools run --rm secrets-bootstrap \
  python -m app.bootstrap_secrets --file /run/bootstrap/rotation.local.json --mode upsert
docker compose restart agent wa-bridge
echo "Token rotado; agente y bridge reiniciados coordinadamente."
