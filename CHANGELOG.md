# Changelog

## [Unreleased]

### Added — 2026-07-15

- Gestión fail-closed del token interno mediante Floci Secrets Manager en los módulos
  `agent/app/secret_provider.py` y `bridge/src/runtime-secrets.js`.
- Bootstrap seguro, validación y rotación explícita mediante servicios one-shot y
  scripts operativos.
- Preparación de Floci diferenciada para servidores `amd64` y Raspberry `arm64`.
