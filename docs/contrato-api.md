# Contrato de la API

Convenciones que comparten Access-Now-API y Access-Now-Frontend. Son las mismas de COTIZA (`cotizapp-backend/docs/contrato-api.md`). Todas las rutas cuelgan de `/api`.

## Errores

Toda respuesta de error usa el mismo cuerpo JSON:

```json
{ "ok": false, "message": "Texto para mostrar al usuario", "statusCode": 400, "details": null }
```

- `message` siempre es legible por el usuario; nunca incluye stack traces ni detalles internos.
- `details` es `null` o un objeto con información estructurada (por ejemplo `{ "fields": ["correo"] }` en un duplicado, o `{ "retryAfterSeconds": 60 }` en un 429).
- El backend construye el cuerpo con `ErrorService.send` / `ErrorService.handleApiError` (`api/middlewares/errors/error-handler.ts`); no se responde `{ error }` ni `{ msg }`.

| Estado | Cuándo |
|---|---|
| 400 | Datos inválidos: DTO, JSON mal formado, campos no permitidos, regla que no se cumple (por ejemplo desactivarte a ti mismo) |
| 401 | Sin token, token inválido o expirado, credenciales incorrectas, enlace de recuperación inválido |
| 403 | El rol o el perfil no permiten la acción, usuario o perfil inactivo |
| 404 | El recurso no existe, o la ruta `/api/*` no existe |
| 409 | Conflicto: clave duplicada (correo, nombre de perfil), registro en uso |
| 413 | Cuerpo demasiado grande |
| 429 | Demasiados intentos (login, recuperación de contraseña). Trae el encabezado `Retry-After` |
| 500 | Error inesperado (mensaje genérico) |
| 503 | Servicio externo caído (SMTP) |

Reglas del frontend:

- Lee el cuerpo y lanza `ApiError(message, statusCode, details)`.
- Un 401 en una petición con sesión cierra la sesión. En login y recuperación de contraseña, no.

## Respuestas exitosas

- Un registro (crear, leer, actualizar, eliminar): el objeto directo, sin envolver. Crear responde `201`.
- Un listado: `{ "items": [...], "total": n }` (ver "Paginación").
- Login y renovar sesión: `{ "token": "…", "usuario": { …, "modules": [...], "proyectos": [{ "id", "nombre", "clave", "estado" }] } }`. `SUPER_ROLE` recibe todos los proyectos; `ADMIN_ROLE`, sus proyectos activos.
- Nunca se responde `password` ni tokens de recuperación.
- Nunca se responden `enrollmentTokenHash` ni `enrollmentTokenExpiresAt`; el token de enrolamiento se muestra una vez.

### Auditoría visible

Toda entidad de negocio incluye `creadoPor`, `creadoEn`, `actualizadoPor` y `actualizadoEn`. `creadoPor` y
`actualizadoPor` identifican públicamente al usuario con al menos `{ "id", "nombre" }`; una operación
automática se representa como `Sistema`. Las fechas usan ISO 8601. El cliente no envía ni puede modificar
estos campos.

Los boletos incluyen además un historial inmutable de acciones relevantes (creación, validación,
cancelación, reasignación y cambios de estado), con acción, actor y fecha.

## Paginación

Todos los listados usan la misma convención:

- Query: `desde` (offset, base 0, por defecto 0) y `limite` (por defecto 10; 50 en perfiles; máximo 100).
- Filtro de texto opcional: `buscar`.
- Respuesta `200`: `{ "items": [...], "total": n }`, donde `total` es el número de registros que cumplen el filtro (no solo los de la página).
- Una lista vacía responde `200` con `{ "items": [], "total": 0 }`, nunca `404`.
- Valores inválidos se corrigen (negativos a 0, no numéricos al valor por defecto, más de 100 a 100).

## Cuerpos

- Cada campo tiene un solo nombre canónico.
- Un campo desconocido responde `400` "Campos no permitidos: …" al crear y al actualizar.
- En una actualización (`PATCH`) solo se cambian los campos enviados. `permissionProfileId: null` quita el perfil.

## Reglas de validación compartidas

El frontend valida lo mismo antes de enviar; el backend es la fuente de verdad.

| Regla | Valor |
|---|---|
| Contraseña | Mínimo 8 caracteres, sin espacios, con mayúscula, minúscula y número (`domain/policies/user/password-policy.ts`) |
| Correo | `texto@dominio.ext` sin espacios, extensión de 2 o más caracteres; se guarda en minúsculas |
| Ids | UUID; un id con otro formato responde `404` como si no existiera |
| Rol | `SUPER_ROLE` o `ADMIN_ROLE` (por defecto `ADMIN_ROLE`) |
| Perfil | Obligatorio y activo para `ADMIN_ROLE`; se ignora para `SUPER_ROLE` |
| Módulos de un perfil | Al menos uno de `users`, `permissionProfiles`, `projects`, `events`, `tickets`, `scanners`, `orders` |
| Clave de proyecto | Única; se guarda en mayúsculas, sin acentos y con guiones (`"Estadio gdl"` → `ESTADIO-GDL`), máximo 40 |
| Ubicación de proyecto | `latitud` y `longitud` se envían ambas o ninguna; aceptan `null` para quitarla; rangos -90..90 y -180..180 |
| Imagen de proyecto | Multipart campo `imagen`; JPG, PNG o WebP; máximo 5 MB |
| MAC de dispositivo | Se normaliza como `AA:BB:CC:DD:EE:FF`; única dentro del proyecto; opcional solo para gateways |
| IPv4 de dispositivo | Cuatro octetos decimales entre 0 y 255 |
| Terminal | Requiere `gatewayId`, `mac` y `sentido`: `ENTRADA`, `SALIDA` o `BIDIRECCIONAL`; `carril` es opcional |
| Gateway | No acepta campos de terminal; no se elimina mientras tenga terminales (`409`) |
| `proyectoIds` de un usuario | UUIDs de proyectos existentes. Se ignora para `SUPER_ROLE`. Un admin solo asigna sus propios proyectos (403 si no) y debe dejar al menos uno; los proyectos que no ve se conservan |

## Endpoints

| Método y ruta | Quién | Respuesta |
|---|---|---|
| `GET /ping`, `GET /health` | Público | Estado del servicio y de la base |
| `POST /auth/login` | Público | `{ token, usuario }`. Cuerpo `{ correo, password }` |
| `GET /auth/renew` | Sesión | `{ token, usuario }` actualizados |
| `POST /auth/forgot-password` | Público | `{ message }`, igual exista o no la cuenta |
| `GET /auth/reset-password/:token` | Público | Página HTML para elegir la contraseña nueva |
| `POST /auth/reset-password` | Público | `{ message }`. Cuerpo `{ token, newPassword, confirmPassword? }` |
| `GET /usuarios` | Módulo `users` | `{ items, total }` (`desde`, `limite`, `buscar`). Un admin solo ve a los usuarios de sus proyectos (y a sí mismo) |
| `POST /usuarios` | Módulo `users` | Usuario creado (`201`) |
| `GET/PATCH /usuarios/:id` | Módulo `users` | Usuario |
| `DELETE /usuarios/:id` | `SUPER_ROLE` | Usuario eliminado |
| `GET /perfiles-permisos/modulos` | Módulo `permissionProfiles` | `{ items, total }` con los módulos disponibles |
| `GET /perfiles-permisos` | Módulo `permissionProfiles` | `{ items, total }` (`desde`, `limite`, `buscar`) |
| `POST /perfiles-permisos` | Módulo `permissionProfiles` | Perfil creado (`201`) |
| `GET/PATCH /perfiles-permisos/:id` | Módulo `permissionProfiles` | Perfil |
| `DELETE /perfiles-permisos/:id` | `SUPER_ROLE` | Perfil eliminado; `409` si tiene usuarios |
| `GET /proyectos` | Módulo `projects` | `{ items, total }` (`desde`, `limite`, `buscar` por nombre, clave o ciudad). Un admin solo ve los suyos |
| `POST /proyectos` | `SUPER_ROLE` | Proyecto creado (`201`); acepta `latitud`/`longitud`; `409` si la clave existe |
| `GET/PATCH /proyectos/:proyectoId` | Módulo `projects` y acceso al proyecto | Proyecto; PATCH acepta `latitud`/`longitud`; `403` si no es de sus proyectos |
| `PUT /proyectos/:proyectoId/imagen` | Módulo `projects` y acceso al proyecto | Proyecto actualizado. Multipart campo `imagen` |
| `DELETE /proyectos/:proyectoId/imagen` | Módulo `projects` y acceso al proyecto | Proyecto actualizado con `img: ""` |
| `DELETE /proyectos/:proyectoId` | `SUPER_ROLE` | Proyecto eliminado (y sus asignaciones a usuarios) |
| `GET /proyectos/:proyectoId/dispositivos` | Módulo `scanners` y acceso al proyecto | `{ items, total }`; filtros `tipo`, `gatewayId`, `buscar`, `desde`, `limite` |
| `POST /proyectos/:proyectoId/dispositivos` | Módulo `scanners` y acceso al proyecto | Dispositivo creado (`201`). Una terminal activa encola `CONFIGURAR_TERMINAL` y queda `configEstado: PENDIENTE` |
| `GET/PATCH/DELETE /proyectos/:proyectoId/dispositivos/:id` | Módulo `scanners` y acceso al proyecto | Dispositivo; otro proyecto responde `404`. En terminales: cambio de IP, carril o sentido, o reactivación → `CONFIGURAR_TERMINAL`; desactivar o borrar → `ELIMINAR_TERMINAL`; cambio de gateway o de MAC → ambos. Renombrar no encola nada |
| `POST /proyectos/:proyectoId/dispositivos/:id/token-enrolamiento` | Módulo `scanners` y acceso al proyecto | Solo gateway; recibe vigencia de 1/24/168 horas y enrolamiento de 30/90 días o sin vencimiento; token visible una vez |
| `POST /proyectos/:proyectoId/dispositivos/:id/revocar-enrolamiento` | Módulo `scanners` y acceso al proyecto | Solo gateway. Invalida el token operativo y cualquier token de enrolamiento sin usar; el gateway sigue registrado y activo (`enrolado: false`). Evento `REVOCADO`. `409` si no está enrolado ni tiene token vigente |
| `GET /proyectos/:proyectoId/dispositivos/:id/estado` | Módulo `scanners` y acceso al proyecto | `{ tipo, enLinea, ultimaConexion, umbralFueraDeLineaMs, enrolamiento, configEstado, configError, gateway }`. En línea solo con un heartbeat dentro del umbral (`DEVICE_OFFLINE_AFTER_MS`, 180 s por defecto); una terminal, solo si su gateway está en línea y la reporta |
| `GET /proyectos/:proyectoId/dispositivos/:id/historial` | Módulo `scanners` y acceso al proyecto | `{ items, total }` (`desde`, `limite`), más reciente primero. Eventos inmutables: `TOKEN_GENERADO`, `ENROLADO`, `REENROLADO`, `CONECTADO`, `DESCONECTADO`, `ENROLAMIENTO_VENCIDO`, `ERROR`, `TERMINAL_DETECTADA`, `ALERTA_SEGURIDAD`, `REVOCADO`, con `detalle`, `creadoEn` y `actor` |
| `GET /proyectos/:proyectoId/dispositivos/:id/comandos` | Módulo `scanners` y acceso al proyecto | `{ items, total }` (`desde`, `limite`), más reciente primero: la cola del gateway o los comandos de la terminal. Cada uno: `{ id, gatewayId, terminalId, tipo, estado, payload, resultado, error, intentos, entregadoEn, finalizadoEn, creadoPor, creadoEn, actualizadoPor, actualizadoEn }` |
| `POST /proyectos/:proyectoId/dispositivos/:id/sincronizar` | Módulo `scanners` y acceso al proyecto | Comando creado (`201`). Gateway: `SINCRONIZAR` con todas sus terminales activas (`409` si no tiene). Terminal: `CONFIGURAR_TERMINAL` otra vez (`409` si está inactiva) |
| `POST /proyectos/:proyectoId/dispositivos/:id/comandos/:comandoId/cancelar` | Módulo `scanners` y acceso al proyecto | Comando `CANCELADO`; solo si está `PENDIENTE` (`409` si ya se entregó); sus terminales quedan en `ERROR` para reaplicarlas |
| `GET /v1/me` | Gateway (`Authorization: Bearer <token operativo>` y `X-Device-Fingerprint`) | `{ device: { id, name, fingerprint }, service: { type, expires_at, settings } }`; `settings` igual que en el enrolamiento; `401 Invalid token`, `Enrollment expired`, `Device fingerprint required` o `Device fingerprint mismatch` |
| `POST /v1/device/heartbeat` | Gateway (token operativo y `X-Device-Fingerprint`) | Cuerpo `{ version?, ip?, terminales?, resultados? }`, todo opcional. `terminales` (máx. 256, solo cuando cambian): lista completa `{ mac, ip, modelo?, enLinea?, ultimaConexion? }`; MAC conocida actualiza IP y presencia, MAC nueva se registra como terminal `CONFIGURADA` (`TERMINAL_DETECTADA`), las que faltan quedan fuera de línea. `resultados` (máx. 100): `{ id, ok, error?, datos? }` de comandos entregados; en `SINCRONIZAR`, `datos.terminales: [{ mac, ok, error? }]`. Responde `{ ok: true, serverTime, intervaloSegundos, comandos: [{ id, tipo, payload, intentos }], resultadosRecibidos }` (máx. 20 comandos). Ver "Cola de comandos" |
| `POST /v1/device/enroll` | Público con token de enrolamiento | Contrato SCAT: recibe `{ token, device_fingerprint, device_name }`; consume el token y responde `{ token_type, token, service }`. El token es opaco (aleatorio, solo se guarda su hash); `service.settings` trae `{ proyecto: { id, nombre, clave }, gateway: { id, nombre }, intervaloSegundos }`. Encola `SINCRONIZAR` con las terminales activas |

Cada endpoint nuevo o modificado se agrega a esta tabla en el mismo commit.

## Cola de comandos (gateways)

La API nunca llama a la Raspberry: las órdenes esperan en `dispositivo_comandos` y viajan en la
respuesta del heartbeat. El gateway las ejecuta en orden y reporta el resultado en un heartbeat posterior.

- Estados: `PENDIENTE` → `ENTREGADO` → `APLICADO` o `ERROR`; `CANCELADO` si se reemplaza o se cancela.
- Un comando nuevo reemplaza a los `PENDIENTE` de la misma terminal (por MAC) en el mismo gateway;
  un `SINCRONIZAR` reemplaza a otro pendiente. Solo viaja el estado más reciente.
- Un `ENTREGADO` sin resultado se reenvía tras `DEVICE_COMMAND_RETRY_MS` (5 min); después de
  `DEVICE_COMMAND_MAX_ATTEMPTS` entregas (5) queda en `ERROR`. El gateway debe tratar los comandos
  como idempotentes: puede recibir uno dos veces.
- `configEstado` de la terminal: `PENDIENTE` al encolar; `CONFIGURADA`, `RETIRADA` (tras
  `ELIMINAR_TERMINAL`) o `ERROR` con `configError` al cerrar. No cambia si la terminal ya tiene otro
  comando abierto, cambió de gateway o de MAC.
- `resultadosRecibidos` incluye resultados repetidos o tardíos: el gateway puede olvidarlos.
- Enrolar o re-enrolar un gateway encola `SINCRONIZAR` con sus terminales activas.
- Lo que reporta el gateway se atribuye a `Gateway <nombre>` en la auditoría.

`payload` de `CONFIGURAR_TERMINAL` y `ELIMINAR_TERMINAL`: `{ terminal: { terminalId, nombre, ip, mac, carril, sentido } }`;
de `SINCRONIZAR`: `{ terminales: [ ...mismo formato ] }`.

## Seguridad de los gateways (`/api/v1`)

- **Solo HTTPS en producción.** El token operativo viaja en cada llamada; detrás de un proxy, configurar `TRUST_PROXY` para que los límites usen la IP real.
- **Token de enrolamiento:** aleatorio de 256 bits, de un solo uso, vence en 1/24/168 horas y solo lo genera un usuario con módulo `scanners` y acceso al proyecto.
- **Token operativo:** aleatorio de 256 bits; la API solo guarda su SHA-256. Deja de servir al desactivar el gateway, al re-enrolarlo, al vencer el enrolamiento o con `revocar-enrolamiento`.
- **Huella del dispositivo:** cada llamada autenticada envía `X-Device-Fingerprint` con la huella del enrolamiento (comparación en tiempo constante). Sin ella → `401`; distinta → `401` y evento `ALERTA_SEGURIDAD` (`motivo: HUELLA_DISTINTA`). SCAT debe derivarla del hardware (número de serie del CPU) para que una SD clonada en otra placa no sirva.
- **Uso simultáneo:** si el gateway reporta desde otra IP de origen mientras seguía en línea → `ALERTA_SEGURIDAD` (`motivo: IP_ORIGEN_SIMULTANEA`, `ipAnterior`, `ipNueva`). Máximo una alerta cada 10 minutos por gateway.
- **Límite de intentos fallidos por IP** (15 min): 10 en `POST /v1/device/enroll` (cuentan `400`, `401`, `403`) y 20 en las rutas con token (`401`, `403`); después `429` con `Retry-After`. Las llamadas válidas nunca cuentan.

