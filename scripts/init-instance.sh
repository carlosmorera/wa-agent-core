#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
umask 077

if [ ! -f .env ]; then
  cp .env.example .env
  chmod 600 .env
fi

ARCH="$(uname -m)"
CONFIGURED_FLOCI_IMAGE="$(sed -n 's/^FLOCI_IMAGE=//p' .env | head -1)"
if [ -z "${FLOCI_IMAGE:-}" ]; then
  case "$ARCH" in
    aarch64|arm64) FLOCI_IMAGE="wa-agent-core-floci-arm64:${FLOCI_VERSION:-1.5.30}" ;;
    *) FLOCI_IMAGE="${CONFIGURED_FLOCI_IMAGE:-floci/floci:${FLOCI_VERSION:-1.5.30}}" ;;
  esac
  export FLOCI_IMAGE
fi
sed -i "s#^FLOCI_IMAGE=.*#FLOCI_IMAGE=$FLOCI_IMAGE#" .env

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
