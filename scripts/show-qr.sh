#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

QR_DIRECTORY="$(mktemp -d /tmp/wa-agent-core-qr.XXXXXX)"
QR_IMAGE="$QR_DIRECTORY/pairing-qr.png"
QR_PAGE="$QR_DIRECTORY/index.html"
trap 'rm -rf "$QR_DIRECTORY"' EXIT
chmod 700 "$QR_DIRECTORY"

cat > "$QR_PAGE" <<'EOF'
<!doctype html>
<meta charset="utf-8">
<title>WhatsApp pairing</title>
<style>
  body { background: #f4f1e8; color: #17201d; font: 18px sans-serif; text-align: center; }
  img { image-rendering: pixelated; width: min(80vw, 640px); }
</style>
<h1>Vincular WhatsApp</h1>
<img id="qr" src="pairing-qr.png" alt="QR temporal">
<p>Esta imagen se actualiza automaticamente.</p>
<script>
  setInterval(() => { document.getElementById('qr').src = `pairing-qr.png?${Date.now()}`; }, 1000);
</script>
EOF
chmod 600 "$QR_PAGE"

attempts=0
last_checksum=""
opened=0
while [ "$attempts" -lt 180 ]; do
  if docker compose exec -T wa-bridge test -s /tmp/wa-bridge.ready; then
    printf 'WhatsApp ya esta vinculado.\n'
    exit 0
  fi
  if docker compose exec -T wa-bridge test -s /tmp/wa-bridge.qr.png; then
    checksum="$(docker compose exec -T wa-bridge sha256sum /tmp/wa-bridge.qr.png)"
    if [ "$checksum" != "$last_checksum" ]; then
      docker compose cp wa-bridge:/tmp/wa-bridge.qr.png "$QR_IMAGE" >/dev/null
      chmod 600 "$QR_IMAGE"
      last_checksum="$checksum"
      if [ "$opened" -eq 0 ]; then
        printf 'Abra %s para escanear el QR temporal.\n' "$QR_PAGE"
        if command -v xdg-open >/dev/null 2>&1; then
          xdg-open "$QR_PAGE" >/dev/null 2>&1 &
        fi
        opened=1
      fi
    fi
  fi
  attempts=$((attempts + 1))
  sleep 1
done

printf 'No se completo la vinculacion en 180 segundos. Revise los eventos del bridge.\n' >&2
exit 1
