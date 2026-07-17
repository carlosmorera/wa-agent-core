# Changelog

## [Unreleased]

### Added — 2026-07-15

- API FastAPI mínima en `agent/app/main.py`, autenticada mediante
  `X-Internal-Token`, con healthcheck y saludo personalizado.
- Bootstrap del agente que resuelve el secreto antes de importar y abrir la API.
- Gestión fail-closed del token interno mediante Floci Secrets Manager en los módulos
  `agent/app/secret_provider.py` y `bridge/src/runtime-secrets.js`.
- Bootstrap seguro, validación y rotación explícita mediante servicios one-shot y
  scripts operativos.
- Preparación de Floci diferenciada para servidores `amd64` y Raspberry `arm64`.
