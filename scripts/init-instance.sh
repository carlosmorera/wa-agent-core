#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
umask 077

if [ ! -f .env ]; then
  cp .env.example .env
  chmod 600 .env
fi

./scripts/prepare-floci.sh
docker compose up -d floci

BOOTSTRAP_FILE="secrets/bootstrap.local.json"
if [ ! -f "$BOOTSTRAP_FILE" ]; then
  INSTANCE_ID="$(sed -n 's/^INSTANCE_ID=//p' .env | head -1)"
  INSTANCE_ID="${INSTANCE_ID:-local}"
  TOKEN="$(openssl rand -hex 32)"
  printf '{\n  "secrets": {\n    "wa-agent-core/%s/internal-api-token": "%s"\n  }\n}\n' "$INSTANCE_ID" "$TOKEN" > "$BOOTSTRAP_FILE"
  chmod 600 "$BOOTSTRAP_FILE"
fi

docker compose --profile tools run --rm secrets-bootstrap
docker compose run --rm secrets-validate
docker compose up -d agent wa-bridge
echo "Instancia iniciada. Revise los logs del bridge para escanear el QR."
