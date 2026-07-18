# Auditoria de Diseno y Patrones - 2026-07-18

## Resumen Ejecutivo

- Estado general: base MVP pequena, coherente y operativamente documentada.
- Riesgo de diseno: bajo para el alcance actual. Las contradicciones de seguridad y configuracion detectadas fueron corregidas en el arbol de trabajo.
- Componentes revisados: Compose, bridge Node.js, agente FastAPI, secretos, scripts, persistencia, pruebas y documentacion operativa.
- Alcance no revisado: restauracion de backups y disponibilidad prolongada de Floci.

## Problemas Criticos

No se encontraron problemas criticos.

## Hallazgos de Alta Prioridad

- **Resuelto:** el QR se genera como PNG en `/tmp/wa-bridge.qr.png` con permisos `0600`, se consulta con `scripts/show-qr.sh` y se elimina en cada transicion terminal. Los logs solo contienen eventos estables.
- **Resuelto:** inicializacion y rotacion comparten `scripts/runtime-config.sh`, respetan `SECRET_INTERNAL_API_TOKEN_NAME` y validan nombres antes de generar JSON.

## Hallazgos de Prioridad Media

- **Resuelto:** `whatsapp-web.js` intentaba persistir su cache en `/app/.wwebjs_cache`, pero el bridge ejecuta como UID 1000 y `/app` no es escribible. El cache se movio a `/tmp/wa-bridge-web-cache`; el cliente ahora alcanza `ready` y queda healthy.
- **Degradacion controlada:** la version actual de WhatsApp Web puede hacer fallar `message.getChat()`. El bridge continua sin typing, llama al agente y registra `message_typing_unavailable` sin exponer datos.
- **Resuelto:** las herramientas one-shot dependen del healthcheck nativo de Floci 1.5.30 mediante `service_healthy`.
- **Resuelto:** URL, timeout y configuracion de escritura se validan durante la construccion del bridge.
- **Resuelto:** `qr`, `ready`, `auth_failure` y `disconnected` actualizan de forma coherente los archivos runtime y tienen pruebas de transicion.
- **Resuelto:** los fallos de contacto, ACL y chat se contienen; antes de aprobar ACL nunca se responde y despues la respuesta de error es best-effort.
- **`bridge/src/index.js:36-38`:** cada mensaje se procesa concurrentemente sin orden por chat ni deduplicacion. No incumple el saludo MVP, pero respuestas lentas pueden llegar fuera de orden y eventos repetidos pueden generar respuestas duplicadas. Antes de incorporar un agente con efectos de negocio se debe definir orden, idempotencia y limite de concurrencia.

## Hallazgos de Baja Prioridad

- **`agent/requirements.txt`, `agent/Dockerfile:8-10`:** las dependencias de pruebas se instalan en la imagen de produccion. Separarlas reduciria tamano y superficie, aunque el beneficio debe compararse con la complejidad de mantener dos instalaciones.
- **`docker-compose.yaml:12-113`, `bridge/src/index.js:14-18`:** el aislamiento de red y UID/GID es favorable, pero faltan controles de hardening como `no-new-privileges`, limites de PIDs y reduccion de capacidades. Chromium usa `--no-sandbox`, por lo que el aislamiento del contenedor merece una revision especifica antes de exposicion productiva.
- **`docs/seguimiento_implementacion.md:10`:** el documento afirma que no hay remoto configurado, pero `main` sigue `origin/main`. Debe actualizarse para que el seguimiento no contradiga el estado operativo.

## Responsabilidades y Cohesion

El bridge separa filtrado, ACL, mapeo, typing, transporte HTTP, secretos y coordinacion en modulos pequenos. `message-handler.js` actua como orquestador sin absorber detalles de infraestructura. El agente mantiene el contrato y la respuesta simple en una sola unidad, adecuado para su alcance actual.

No hay evidencia que justifique dividir mas `agent/app/main.py` ni introducir una capa de dominio. La logica de negocio actual es un saludo y nuevas abstracciones aumentarian complejidad sin reducir razones reales de cambio.

## Acoplamiento y Dependencias

- Las dependencias externas importantes admiten inyeccion en pruebas: `fetchImpl`, cliente de secretos, entorno, logger y ACL.
- El contrato bridge-agente es explicito y validado por Pydantic, pero no hay una prueba integrada que ejecute el payload real del mapper contra FastAPI.
- Python, Node y los scripts resuelven el mismo nombre de secreto, incluido el override, y tienen pruebas de regresion.
- El bridge depende directamente de la API de eventos de `whatsapp-web.js` solo en `index.js`, lo que mantiene acotado el acoplamiento con el proveedor.

## Patrones Existentes

- Patron: Composition Root mediante funciones fabrica.
- Ubicacion: `bridge/src/index.js:22-27`, `agent/app/bootstrap.py`.
- Intencion: construir dependencias y mantener la logica probada fuera del arranque.
- Estado de implementacion: apropiado y simple.
- Riesgos: nuevas variables de entorno deben validarse durante la construccion antes de inicializar WhatsApp.

- Patron: Adapter funcional para dependencias externas.
- Ubicacion: `bridge/src/agent-client.js`, `bridge/src/secrets-manager-client.js`, `agent/app/aws_secrets.py`.
- Intencion: ocultar HTTP, firma AWS y SDK detras de operaciones pequenas.
- Estado de implementacion: adecuado; permite dobles sin interfaces ceremoniales.
- Riesgos: el cliente Secrets Manager Node carece de pruebas directas para firma, timeout y payloads invalidos.

- Patron: pipeline explicito de procesamiento.
- Ubicacion: `bridge/src/message-handler.js` con filtro, ACL, mapeo, llamada y respuesta.
- Intencion: ordenar decisiones sin una Chain of Responsibility formal.
- Estado de implementacion: la secuencia directa es mas clara que introducir handlers encadenados para cinco pasos estables.
- Riesgos: faltan decisiones explicitas sobre concurrencia e idempotencia.

## Patrones Candidatos

- Problema: mensajes concurrentes pueden responderse fuera de orden por chat.
- Patron candidato: cola serial por clave o Command queue.
- Alternativa simple: mantener el comportamiento actual mientras el agente no tenga estado ni efectos de negocio.
- Beneficio: orden, backpressure y un lugar para deduplicacion.
- Costo: estado en memoria, limpieza de colas, recuperacion ante reinicios y nuevas pruebas.
- Recomendacion: no implementarlo aun; convertirlo en requisito antes de agregar memoria, LLM o acciones de negocio.

- Problema: configuracion de entorno dispersa.
- Patron candidato: objeto de configuracion validado construido en el composition root.
- Alternativa simple: dos funciones pequenas que validen enteros y URLs al arrancar.
- Beneficio: fallo temprano y configuracion consistente.
- Costo: una unidad adicional y migracion de firmas.
- Recomendacion: preferir primero la alternativa simple; no incorporar un framework de configuracion.

## Sobreingenieria

No se detectaron factories ceremoniales, jerarquias, interfaces de una sola implementacion ni patrones innecesarios. El uso de modulos y funciones es natural para el tamano del sistema. La principal recomendacion es preservar esta simplicidad y no modelar prematuramente un dominio conversacional que todavia no existe.

## Evaluacion SOLID

### Responsabilidad unica

Buena en el bridge; cada modulo tiene una razon coherente para cambiar. El agente concentra contrato y saludo, pero su tamano no justifica separacion.

### Abierto/cerrado

Suficiente para el MVP. Filtros y ACL se pueden sustituir por composicion. No existe variabilidad real que justifique estrategias o plugins adicionales.

### Sustitucion de Liskov

No hay jerarquias. Los contratos implicitos de clientes y ACL son pequenos y los dobles de pruebas los sustituyen correctamente.

### Segregacion de interfaces

Los consumidores usan operaciones minimas como `sendMessage`, `isAllowed` y `getSecretString`. No se observan contratos amplios.

### Inversion de dependencias

La logica de coordinacion recibe sus colaboradores, pero el composition root crea implementaciones concretas, que es el lugar correcto. No hace falta un contenedor de inyeccion.

## Plan de Mejora

### Prioridad 1

- [x] Resolver la contradiccion de privacidad y operacion del QR.
- [x] Unificar el nombre efectivo del secreto en consumidores y scripts.

### Prioridad 2

- [x] Invalidar readiness en todos los fallos de autenticacion o desconexion.
- [x] Validar configuracion numerica al arrancar.
- [x] Hacer determinista la espera de disponibilidad de Floci.

### Prioridad 3

- [x] Agregar una prueba del payload bridge-agente.
- [ ] Definir orden e idempotencia antes de agregar efectos de negocio.
- [ ] Revisar hardening del contenedor Chromium y dependencias transitivas deprecadas.

## Validacion Recomendada

- [x] `docker compose run --rm --no-deps -v "$PWD/agent/tests:/app/tests:ro" agent pytest -q -p no:cacheprovider /app/tests`: 19 pruebas pasaron.
- [x] `docker compose run --rm --no-deps -v "$PWD/bridge/test:/app/test:ro" wa-bridge sh -lc 'node --test /app/test/*.test.js'`: 37 pruebas pasaron.
- [x] `docker compose config --quiet`: configuracion valida.
- [x] Smoke test real de vinculacion, mensaje privado y respuesta `Hola {nombre}`.
- [x] Prueba de resolucion con `SECRET_INTERNAL_API_TOKEN_NAME` personalizado.
- [x] Pruebas de ciclo `qr`, `ready`, `auth_failure` y `disconnected`.
- [x] Validacion operativa completa en `amd64`, incluido WhatsApp, respuesta del agente, persistencia y rotacion.
- [ ] Repeticion en `arm64` tras los cambios de QR y cliente WhatsApp.
