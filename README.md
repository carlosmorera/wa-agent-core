# wa-agent-core

Base mínima para conectar un número de WhatsApp con un agente HTTP autenticado. Un
mensaje privado de texto se entrega al agente y recibe como respuesta `Hola {nombre}`.
El token compartido nunca se configura en texto plano: bridge y agente lo recuperan
desde Floci Secrets Manager durante el arranque.

## Requisitos

- Linux de 64 bits: `amd64` o `arm64`.
- Docker Engine con Docker Compose v2.
- Git y OpenSSL.
- En Raspberry: sistema operativo ARM64 y memoria suficiente para Chromium.

No se soportan sistemas de 32 bits.

## Inicio rápido

```bash
cp .env.example .env
chmod 600 .env
```

Edite como mínimo:

```env
INSTANCE_ID=mi-negocio
PUID=1000
PGID=1000
```

Use `id -u` e `id -g` para conocer el UID/GID del operador. Luego ejecute:

```bash
./scripts/init-instance.sh
docker compose logs -f wa-bridge
```

Escanee el QR desde WhatsApp. `init-instance.sh` detecta la arquitectura, prepara
Floci, genera un token de 256 bits si no existe, lo aprovisiona sin sobrescribir un
secreto previo y levanta los servicios en orden.

En Raspberry ARM64, el primer arranque compila la variante JVM fijada de Floci. En
`amd64` usa la imagen versionada configurada por Compose.

## Servicios

- `floci`: Secrets Manager persistente; no publica puertos al host.
- `agent`: FastAPI privada con `GET /health` y `POST /v1/messages`.
- `wa-bridge`: WhatsApp Web, sesión persistente y único servicio con salida a internet.
- `secrets-bootstrap`: herramienta one-shot bajo el profile `tools`.
- `secrets-validate`: validación fail-closed previa al agente.

## Contrato del agente

```http
POST /v1/messages
X-Internal-Token: <resuelto desde Floci>
Content-Type: application/json
```

```json
{
  "message_id": "message-1",
  "chat_id": "573000000001@c.us",
  "sender_id": "573000000001@c.us",
  "sender_name": "Cliente",
  "text": "Hola",
  "timestamp": 1750000000
}
```

```json
{"reply": "Hola Cliente"}
```

El endpoint no se publica al host. Token ausente o incorrecto produce `401`.

## ACL

Demostración:

```env
BRIDGE_ACL_MODE=open
```

Producción:

```env
BRIDGE_ACL_MODE=allowlist
BRIDGE_ALLOWED_NUMBERS=573000000001,573000000002
```

Después de cambiar la ACL:

```bash
docker compose up -d --force-recreate wa-bridge
```

## Operación

```bash
docker compose ps
docker compose logs --tail=100 floci agent wa-bridge
docker compose run --rm secrets-validate
./scripts/rotate-internal-token.sh
```

La rotación actualiza el secreto y reinicia coordinadamente agente y bridge. No
imprime el valor anterior ni el nuevo.

### Backup

Para una copia consistente, detenga los servicios y archive ambos volúmenes:

```bash
docker compose stop wa-bridge agent floci
tar -czf wa-agent-core-backup.tgz data/whatsapp-session data/floci
docker compose up -d
```

Proteja el archivo: contiene la sesión de WhatsApp y el almacenamiento local de
Secret Manager. Para restaurar, detenga los servicios, conserve una copia del
directorio `data/`, extraiga el archivo en la raíz y ejecute `docker compose up -d`.
Respete los UID/GID originales.

### systemd opcional

Después de completar `init-instance.sh`, adapte y copie
`systemd/wa-agent-core.service` a `/etc/systemd/system/`. La unidad no provisiona
secretos: únicamente levanta una instancia ya inicializada.

## Pruebas

```bash
docker compose run --rm --no-deps \
  -v "$PWD/agent/tests:/app/tests:ro" agent \
  pytest -q -p no:cacheprovider /app/tests

docker compose run --rm --no-deps \
  -v "$PWD/bridge/test:/app/test:ro" wa-bridge \
  sh -lc 'node --test /app/test/*.test.js'

docker compose config --quiet
```

La prueba final de WhatsApp requiere escanear el QR y enviar un mensaje privado desde
otro número.

## Seguridad y límites

- No versione `.env`, `secrets/*.json`, `data/floci` ni la sesión de WhatsApp.
- El archivo de bootstrap exige permisos `0600` y no se monta en servicios permanentes.
- Las credenciales AWS `test` solo firman llamadas locales; no son una frontera de seguridad.
- Floci centraliza secretos, pero el cifrado de disco y los backups son responsabilidad del host.
- Esta versión no incluye LLM, memoria, funciones de negocio, grupos ni multimedia.

La arquitectura completa está en [docs/architecture.md](docs/architecture.md) y el
control de tareas en [docs/seguimiento_implementacion.md](docs/seguimiento_implementacion.md).
