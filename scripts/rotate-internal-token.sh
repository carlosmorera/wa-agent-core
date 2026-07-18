#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
umask 077
source ./scripts/runtime-config.sh

SECRET_NAME="$(internal_token_secret_name)"
ROTATION_FILE="secrets/rotation.local.json"
TOKEN="$(openssl rand -hex 32)"
trap 'rm -f "$ROTATION_FILE"' EXIT
write_secret_file "$ROTATION_FILE" "$SECRET_NAME" "$TOKEN"

docker compose --profile tools run --rm secrets-bootstrap \
  python -m app.bootstrap_secrets --file /run/bootstrap/rotation.local.json --mode upsert
docker compose restart agent wa-bridge
echo "Token rotado; agente y bridge reiniciados coordinadamente."
