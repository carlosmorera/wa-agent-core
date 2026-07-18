# Plan de mejoras diferidas

## Estado de entrada

La base esta validada en `amd64`: Floci 1.5.30, healthchecks, persistencia, bootstrap,
rotacion y el flujo real de WhatsApp funcionan. El bridge alcanza `ready` y responde
`Hola {nombre}`. Cuando `message.getChat()` falla, se omite typing sin bloquear el
mensaje.

## Prioridad 0: compatibilidad WhatsApp

Estado: completada el 18 de julio de 2026.

La causa fue el cache relativo de `whatsapp-web.js`: intentaba escribir bajo `/app`,
que correctamente no es writable para UID 1000. Se configuro
`/tmp/wa-bridge-web-cache`, se mantuvo la version estable 1.34.7 y no se incorporaron
forks ni caches remotos. La sesion persistida alcanza `ready` tras reiniciar y el smoke
test responde correctamente; typing queda como capacidad opcional.

Criterios de salida:

- `wa-bridge` queda `healthy`.
- `/tmp/wa-bridge.ready` existe con modo `0600` y el PNG temporal fue eliminado.
- Un reinicio conserva la vinculacion.
- El smoke test real responde `Hola {nombre}` sin datos privados en logs.

## Prioridad 1: orden y limites de concurrencia

Condicion de inicio: Prioridad 0 completada y existencia de una necesidad observable
de procesar mensajes simultaneos.

1. Medir concurrencia real por chat y latencia del agente.
2. Serializar por `chat_id` mediante una cola en memoria con limpieza al quedar vacia.
3. Agregar un limite global pequeno para proteger Chromium y el agente.
4. Definir timeout y comportamiento al llenar la capacidad; no acumular trabajo sin
   limite.
5. Probar orden por chat, paralelismo entre chats, timeout y liberacion de colas.

No usar un broker ni una base de datos para esta fase.

## Prioridad 2: idempotencia

Condicion de inicio: el agente incorpora efectos de negocio o se observan entregas
duplicadas de WhatsApp.

1. Definir la ventana de deduplicacion y la semantica de `message_id`.
2. Decidir si basta deduplicacion en memoria o si debe sobrevivir reinicios.
3. Si debe persistir, documentar almacenamiento, limites, expiracion, backup y
   recuperacion antes de elegir tecnologia.
4. Marcar como procesado solo despues del efecto que corresponda a la semantica
   acordada.
5. Probar duplicados concurrentes, reintentos tras fallo y reinicio.

No agregar persistencia mientras el saludo siga siendo el unico efecto.

## Prioridad 3: hardening de contenedores

Aplicar cada control por separado y ejecutar smoke tests en `amd64` y `arm64`:

1. `security_opt: no-new-privileges:true`.
2. `cap_drop: [ALL]`, confirmando primero las necesidades de Chromium y Floci.
3. `pids_limit` y limites de CPU compatibles con Raspberry.
4. Filesystem de solo lectura para el agente y tmpfs explicitos para `/tmp`.
5. Mantener como unicos destinos persistentes `data/floci` y
   `data/whatsapp-session`.
6. Evaluar el riesgo residual de Chromium con `--no-sandbox`; no retirar esa opcion
   sin una prueba real bajo el usuario no root.

## Prioridad 4: imagen de produccion

1. Separar dependencias Python de prueba y runtime si la reduccion de imagen es
   significativa.
2. Mantener lockfiles exactos y ejecutar auditorias de dependencias en cada cambio.
3. Construir y probar ambas arquitecturas antes de cambiar imagenes base.

## Validacion comun

```bash
docker compose run --rm --no-deps \
  -v "$PWD/agent/tests:/app/tests:ro" agent \
  pytest -q -p no:cacheprovider /app/tests

docker compose run --rm --no-deps \
  -v "$PWD/bridge/test:/app/test:ro" wa-bridge \
  sh -lc 'node --test /app/test/*.test.js'

./scripts/test-runtime-config.sh
docker compose config --quiet
git diff --check
```
