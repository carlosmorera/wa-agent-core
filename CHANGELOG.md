# Changelog

## [Unreleased]

### Changed — 2026-07-18

- El QR de vinculacion se genera como PNG temporal con permisos `0600`, se elimina al
  quedar listo, fallar la autenticacion o desconectarse y nunca se imprime en logs. El
  comando operativo abre una pagina local y refresca los QR rotados.
- Inicializacion y rotacion respetan `SECRET_INTERNAL_API_TOKEN_NAME` y validan los
  identificadores antes de generar archivos de secretos.
- Las herramientas one-shot esperan el healthcheck nativo de Floci y el bridge valida
  URL, timeout y configuracion de escritura antes de conectarse con WhatsApp.
- Los fallos de contacto, ACL, chat, agente y respuesta se contienen y clasifican sin
  exponer datos privados ni responder antes de aprobar la ACL.
- `whatsapp-web.js` se actualiza de 1.34.6 a 1.34.7 por sus correcciones de inicio,
  autenticacion e inyeccion Store. Su cache se ubica en `/tmp` para que el usuario no
  root pueda persistir el HTML y completar `ready`.
- Si WhatsApp no permite resolver el chat para activar typing, el bridge degrada solo
  esa animacion y mantiene la llamada al agente y la respuesta.

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
