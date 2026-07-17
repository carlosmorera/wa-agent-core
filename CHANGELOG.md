# Changelog

## [Unreleased]

### Added — 2026-07-15

- Lockfile reproducible del bridge y construcción mediante `npm ci`.
- Redes separadas para conservar Floci y el agente aislados mientras el bridge mantiene
  salida a WhatsApp Web; ejecución con UID/GID configurable para datos portables.
- Recuperación segura de locks obsoletos de Chromium sin eliminar cookies ni datos de
  autenticación de WhatsApp.
- Bridge WhatsApp con sesión persistente, filtros de chat privado, soporte JID/LID,
  ACL configurable, cliente autenticado del agente y respuesta de error controlada.
- Animación de escritura con limpieza garantizada aun cuando el agente falle.
- API FastAPI mínima en `agent/app/main.py`, autenticada mediante
  `X-Internal-Token`, con healthcheck y saludo personalizado.
- Bootstrap del agente que resuelve el secreto antes de importar y abrir la API.
- Gestión fail-closed del token interno mediante Floci Secrets Manager en los módulos
  `agent/app/secret_provider.py` y `bridge/src/runtime-secrets.js`.
- Bootstrap seguro, validación y rotación explícita mediante servicios one-shot y
  scripts operativos.
- Preparación de Floci diferenciada para servidores `amd64` y Raspberry `arm64`.
