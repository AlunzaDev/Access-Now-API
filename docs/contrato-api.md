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

Cada endpoint nuevo o modificado se agrega a esta tabla en el mismo commit.
