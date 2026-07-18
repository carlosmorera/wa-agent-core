# Stack tecnologico y buenas practicas

Este documento describe las tecnologias usadas por `wa-agent-core`, las razones de
su uso y las convenciones que deben mantenerse al evolucionar el proyecto.

## Vista general

| Capa | Tecnologia | Version de referencia | Responsabilidad |
| --- | --- | --- | --- |
| Orquestacion | Docker Engine y Docker Compose v2 | Compose Specification | Construccion, redes, dependencias, health checks, limites y persistencia |
| Bridge de WhatsApp | Node.js sobre Debian | Node.js 20 | Recibir, filtrar y responder mensajes; conectar WhatsApp con el agente |
| Cliente de WhatsApp | `whatsapp-web.js` | 1.34.7 | Automatizacion de WhatsApp Web mediante Chromium |
| Navegador | Chromium | Paquete de Debian Bookworm | Runtime de WhatsApp Web, sin descarga adicional de Puppeteer |
| API del agente | Python sobre Debian slim | Python 3.12 | Exponer la API HTTP privada y ejecutar la logica del agente |
| Framework HTTP | FastAPI + Uvicorn | 0.116.1 / 0.35.0 | Contrato, validacion y servidor ASGI |
| Modelos de datos | Pydantic, incluido por FastAPI | Version resuelta por `pip` | Validacion de solicitudes y respuestas |
| Secretos | Floci Secrets Manager | 1.5.30 | Almacenar y entregar el token interno de cada instancia |
| Cliente de secretos | AWS SDK | Boto3 1.40.0 | Consumir la API compatible con AWS Secrets Manager de Floci |
| Pruebas Python | Pytest + HTTPX | 8.4.1 / 0.28.1 | Pruebas unitarias y del contrato FastAPI |
| Pruebas Node.js | `node:test` + `node:assert` | Incluidos en Node.js 20 | Pruebas unitarias sin framework adicional |
| Servicio del host | systemd (opcional) | Provisto por Linux | Inicio automatico de una instancia ya aprovisionada |
| Automatizacion | Bash y OpenSSL | Provistos por el host | Inicializacion, preparacion ARM64 y rotacion de secretos |

Las versiones de dependencias de aplicacion estan fijadas en
`agent/requirements.txt` y `bridge/package-lock.json`. Las imagenes base principales
son `python:3.12-slim` y `node:20-bookworm-slim`.

## Arquitectura y limites

- `wa-bridge` es el unico servicio con salida a internet. Mantiene la sesion de
  WhatsApp y llama al agente por HTTP.
- `agent` y `floci` solo viven en la red interna de Compose y no publican puertos al
  host.
- `secrets-bootstrap` y `secrets-validate` son herramientas de ciclo corto. El agente
  solo arranca si la validacion de secretos termina correctamente.
- La autenticacion bridge-agente usa `X-Internal-Token`. El token se obtiene de
  Floci durante el arranque y nunca debe tener un fallback en texto plano.
- `data/floci` y `data/whatsapp-session` son estado persistente y sensible. No son
  codigo fuente ni deben versionarse.

El flujo y las decisiones completas se documentan en `docs/architecture.md`.

## Buenas practicas de desarrollo

### Dependencias y runtimes

- Mantener Node.js 20 y Python 3.12 como versiones minimas mientras las imagenes
  Docker no se actualicen de forma coordinada.
- Fijar versiones exactas de dependencias de produccion. En Node.js, actualizar y
  versionar `package-lock.json`; en Python, actualizar `requirements.txt` y probar la
  imagen resultante.
- Preferir las bibliotecas estandar ya disponibles (`fetch`, `AbortSignal.timeout`,
  `node:test`) antes de incorporar paquetes para funciones equivalentes.
- Actualizar una dependencia por cambio logico cuando sea posible, revisar sus notas
  de version y ejecutar todas las pruebas de ambos runtimes.
- No modificar manualmente archivos generados como `package-lock.json`; usar `npm`
  para mantener su integridad.

### Diseno del codigo

- Conservar modulos pequenos y con una sola responsabilidad: filtrado, ACL, mapeo,
  escritura simulada, cliente HTTP y secretos permanecen separados.
- Inyectar dependencias externas (`fetch`, cliente de secretos, entorno y logger)
  para que la logica pueda probarse sin red ni servicios reales.
- Validar datos en los limites del sistema. FastAPI/Pydantic valida el contrato HTTP;
  el bridge normaliza y verifica valores antes de usarlos.
- Mantener el contrato de `POST /v1/messages` compatible. Si cambia, actualizar en el
  mismo cambio el bridge, los modelos FastAPI, las pruebas y la documentacion.
- Usar operaciones asincronas para I/O en Node.js y establecer siempre un timeout en
  llamadas de red. No dejar promesas sin esperar ni capturar errores sin tratarlos.
- Evitar estado global mutable. Crear componentes mediante funciones o clases con
  dependencias explicitas facilita pruebas, reinicios y futuras extensiones.
- Seguir el estilo existente: CommonJS y modo estricto en JavaScript; PEP 8, type
  hints donde aporten claridad y nombres `snake_case` en Python.

### Seguridad y privacidad

- Aplicar *fail closed*: si falta un secreto, la ACL es invalida o una dependencia no
  esta lista, el servicio no debe continuar con valores inseguros.
- Nunca escribir tokens, contenido privado, credenciales, QR ni datos de sesion en
  logs. Registrar eventos estables y razones sanitizadas, no excepciones completas de
  proveedores externos.
- Comparar secretos con una funcion de tiempo constante, como
  `hmac.compare_digest`; no usar igualdad directa para tokens.
- Mantener `.env` y archivos de bootstrap con permisos `0600`. No versionar `.env`,
  `secrets/*.json`, backups ni los directorios bajo `data/`.
- Ejecutar contenedores con `PUID:PGID`, sin privilegios adicionales, y conservar el
  aislamiento de redes. No publicar puertos salvo que exista una necesidad y una
  revision de seguridad explicitas.
- Usar `BRIDGE_ACL_MODE=allowlist` en produccion y registrar solo el resultado de la
  decision, no informacion personal innecesaria.
- Tratar backups de Floci y de la sesion de WhatsApp como secretos: cifrarlos,
  restringir su acceso y probar periodicamente la restauracion.
- Rotar el token solo con `scripts/rotate-internal-token.sh`, que coordina el reinicio
  sin imprimir los valores.

### Configuracion y operacion

- Toda configuracion variable debe llegar por entorno y estar documentada en
  `.env.example`; los valores sensibles deben ser referencias a Floci, no secretos.
- Agregar valores por defecto unicamente cuando sean seguros para desarrollo y no
  debiliten produccion.
- Mantener health checks baratos, deterministas y libres de secretos. Un estado
  saludable debe indicar que el proceso puede atender su responsabilidad real.
- Conservar limites de memoria y politicas de reinicio en Compose. Validar cualquier
  aumento especialmente en Raspberry Pi.
- Hacer cambios de esquema o persistencia con estrategia de backup, migracion y
  rollback. Nunca eliminar automaticamente datos de sesion para resolver un arranque.
- Mantener compatibilidad `amd64` y `arm64`; no asumir extensiones de CPU, rutas o
  binarios exclusivos de una arquitectura.
- Usar logs estructurados con nombres de evento estables, por ejemplo
  `message_processing_failed`, y mensajes accionables sin datos confidenciales.

### Pruebas y calidad

- Cada correccion debe incluir una prueba que falle antes del arreglo. Cada nueva
  rama importante debe cubrir exito, rechazo y fallo de dependencia.
- Las pruebas unitarias no deben necesitar WhatsApp, internet, Chromium ni Floci.
  Inyectar dobles y usar datos ficticios.
- Cubrir especialmente autenticacion, ACL, filtros de mensajes, timeouts, respuestas
  vacias, errores del agente, resolucion de secretos y validacion de payloads.
- Evitar esperas reales en pruebas. Configurar duraciones a cero o usar dobles de
  reloj cuando se prueben comportamientos temporales.
- Antes de integrar un cambio, ejecutar:

  ```bash
  docker compose run --rm --no-deps \
    -v "$PWD/agent/tests:/app/tests:ro" agent \
    pytest -q -p no:cacheprovider /app/tests

  docker compose run --rm --no-deps \
    -v "$PWD/bridge/test:/app/test:ro" wa-bridge \
    sh -lc 'node --test /app/test/*.test.js'

  docker compose config --quiet
  ```

- Para cambios en el flujo de WhatsApp, completar ademas una verificacion manual con
  QR y un mensaje privado desde otro numero. No usar cuentas ni conversaciones reales
  en pruebas automatizadas.

## Criterio para incorporar tecnologia nueva

Una nueva tecnologia debe resolver una necesidad concreta que la stack actual no
cubra razonablemente. Antes de incorporarla, documentar:

1. El problema y las alternativas evaluadas.
2. El impacto en memoria, imagen Docker y soporte `amd64`/`arm64`.
3. Su modelo de seguridad, permisos, red y manejo de secretos.
4. Como se prueba, observa, actualiza y revierte.
5. Quien mantiene la dependencia y su estado de soporte.

No incorporar un LLM, base de datos, cola, cache o servicio publicado como efecto
secundario de otra funcionalidad: cada uno requiere una decision arquitectonica
explicita y la actualizacion de este documento.
