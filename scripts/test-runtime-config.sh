#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$ROOT_DIR/scripts/runtime-config.sh"

assert_equal() {
  if [ "$1" != "$2" ]; then
    printf 'Esperado: %s\nObtenido: %s\n' "$1" "$2" >&2
    return 1
  fi
}

compose_env_value() {
  case "$1" in
    INSTANCE_ID) printf '%s' "negocio-1" ;;
    SECRET_INTERNAL_API_TOKEN_NAME) printf '%s' "" ;;
  esac
}
assert_equal "wa-agent-core/negocio-1/internal-api-token" "$(internal_token_secret_name)"

compose_env_value() {
  case "$1" in
    INSTANCE_ID) printf '%s' "ignored" ;;
    SECRET_INTERNAL_API_TOKEN_NAME) printf '%s' "custom/team/internal-token" ;;
  esac
}
assert_equal "custom/team/internal-token" "$(internal_token_secret_name)"

compose_env_value() {
  case "$1" in
    INSTANCE_ID) printf '%s' 'invalid/value' ;;
    SECRET_INTERNAL_API_TOKEN_NAME) printf '%s' "" ;;
  esac
}
if internal_token_secret_name >/dev/null 2>&1; then
  printf 'INSTANCE_ID invalido fue aceptado\n' >&2
  exit 1
fi

if validate_secret_name 'invalid secret' >/dev/null 2>&1; then
  printf 'Nombre de secreto invalido fue aceptado\n' >&2
  exit 1
fi

temporary_file="$(mktemp)"
trap 'rm -f "$temporary_file"' EXIT
write_secret_file "$temporary_file" "custom/team/internal-token" \
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
assert_equal "600" "$(stat -c '%a' "$temporary_file")"
contents="$(<"$temporary_file")"
if [[ "$contents" != *'"custom/team/internal-token"'* ]]; then
  printf 'El archivo no contiene el nombre esperado\n' >&2
  exit 1
fi

printf 'runtime-config: OK\n'
