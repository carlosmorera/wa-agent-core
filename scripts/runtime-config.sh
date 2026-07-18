#!/usr/bin/env bash

compose_env_value() {
  local key="$1"
  local line
  while IFS= read -r line; do
    if [[ "$line" == "$key="* ]]; then
      printf '%s' "${line#*=}"
      return 0
    fi
  done < <(docker compose config --environment)
  return 1
}

internal_token_secret_name() {
  local configured
  local instance_id
  configured="$(compose_env_value SECRET_INTERNAL_API_TOKEN_NAME || true)"
  if [ -n "$configured" ]; then
    validate_secret_name "$configured"
    printf '%s' "$configured"
    return 0
  fi

  instance_id="$(compose_env_value INSTANCE_ID || true)"
  instance_id="${instance_id:-local}"
  if [[ ! "$instance_id" =~ ^[A-Za-z0-9._-]{1,128}$ ]]; then
    printf 'INSTANCE_ID contiene caracteres no permitidos\n' >&2
    return 1
  fi
  configured="wa-agent-core/${instance_id}/internal-api-token"
  validate_secret_name "$configured"
  printf '%s' "$configured"
}

validate_secret_name() {
  local name="$1"
  if [ "${#name}" -gt 512 ] || [[ ! "$name" =~ ^[A-Za-z0-9/_+=.@-]+$ ]]; then
    printf 'SECRET_INTERNAL_API_TOKEN_NAME no es valido\n' >&2
    return 1
  fi
}

write_secret_file() {
  local file_path="$1"
  local secret_name="$2"
  local secret_value="$3"
  validate_secret_name "$secret_name"
  if [[ ! "$secret_value" =~ ^[a-f0-9]{64}$ ]]; then
    printf 'El token generado no tiene el formato esperado\n' >&2
    return 1
  fi
  printf '{\n  "secrets": {\n    "%s": "%s"\n  }\n}\n' \
    "$secret_name" "$secret_value" > "$file_path"
  chmod 600 "$file_path"
}
