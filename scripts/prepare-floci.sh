#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ARCH="$(uname -m)"
FLOCI_VERSION="${FLOCI_VERSION:-1.5.30}"
FLOCI_REPO_URL="${FLOCI_REPO_URL:-https://github.com/floci-io/floci.git}"
FLOCI_CACHE_DIR="${FLOCI_CACHE_DIR:-$ROOT_DIR/.cache/floci-src}"

case "$ARCH" in
  x86_64|amd64)
    echo "Arquitectura amd64: se usará ${FLOCI_IMAGE:-floci/floci:$FLOCI_VERSION}."
    ;;
  aarch64|arm64)
    IMAGE="${FLOCI_IMAGE:-wa-agent-core-floci-arm64:$FLOCI_VERSION}"
    if docker image inspect "$IMAGE" >/dev/null 2>&1; then
      echo "Imagen ARM64 existente: $IMAGE"
      exit 0
    fi
    mkdir -p "$(dirname "$FLOCI_CACHE_DIR")"
    if [ -d "$FLOCI_CACHE_DIR/.git" ]; then
      git -C "$FLOCI_CACHE_DIR" fetch --depth 1 origin "refs/tags/$FLOCI_VERSION:refs/tags/$FLOCI_VERSION"
      git -C "$FLOCI_CACHE_DIR" checkout --detach "$FLOCI_VERSION"
    else
      git clone --depth 1 --branch "$FLOCI_VERSION" "$FLOCI_REPO_URL" "$FLOCI_CACHE_DIR"
    fi
    docker build --build-arg "VERSION=$FLOCI_VERSION" -f "$FLOCI_CACHE_DIR/docker/Dockerfile" -t "$IMAGE" "$FLOCI_CACHE_DIR"
    echo "Configure FLOCI_IMAGE=$IMAGE en .env."
    ;;
  *)
    echo "Arquitectura no soportada: $ARCH" >&2
    exit 1
    ;;
esac
