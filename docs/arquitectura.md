# Arquitectura del backend

Cada capa conoce solo a las de adentro. Las reglas de negocio no dependen de Express ni de Prisma, y cambiar cómo se guarda algo no toca los servicios. Es la misma idea que COTIZA (`cotizapp-backend/docs/arquitectura.md`) y que el dashboard (`Access-Now-Frontend/docs/arquitectura.md`).

## Las capas

```
src/
  domain/            El negocio, sin Express, Prisma ni librerías de red:
    constants/         roles y módulos del dashboard (valores guardados)
    entities/          cómo son un usuario, un perfil, un proyecto…
    dtos/              validan y normalizan lo que llega (cuerpos, filtros, paginación)
    datasources/       interfaces de las fuentes de datos
    repository/        interfaces que usan los servicios (hoy iguales a los datasources)
    policies/          reglas puras por módulo: sesión, gestión de usuarios, contraseña…
    ports/             otras dependencias externas: correo (y luego archivos, pagos)
    errors/            CustomError
    helpers/           utilidades puras (isUuid)
  application/
    services/          orquestan un caso: cargan datos con los repositorios y aplican las policies
  infrastructure/    Cómo se habla con el mundo de afuera:
    prisma/            conexión a PostgreSQL y traducción de errores de Prisma
    datasources/       consultas con Prisma (convierten filas en entidades)
    repositories/      implementan las interfaces de domain usando los datasources
    email/             SMTP con nodemailer (implementa EmailSender)
    storage/           disco local o DigitalOcean Spaces (implementa FileStorage)
  api/middlewares/   autenticación, módulos y roles, límites de intentos, manejo de errores
  presentation/
    routes/            rutas y controladores por módulo
    dependencies/      el único lugar donde se crean (new) servicios, middlewares y controladores
    server.ts          Express
  config/            variables de entorno, logger, JWT, bcrypt y plantillas HTML
  generated/         cliente de Prisma (no se versiona; `npm run typecheck` lo genera)
  app.ts             arranca el servidor
```

```
  presentation, api  ──►  application  ──►  domain  ◄──  infrastructure
          │                                                  ▲
          └──────────── arman las dependencias ──────────────┘
```

## El camino de una petición

Ejemplo: `GET /api/usuarios?buscar=ana&desde=0&limite=10`.

1. **Ruta** (`presentation/routes/user/user.routes.ts`): aplica `requireAuth` y `requireModules("users")`.
2. **Middleware** (`api/middlewares/auth/auth.middleware.ts`): valida el token y vuelve a leer el usuario y su perfil con `SessionService`; aplica `domain/policies/auth/session-policy`.
3. **Controlador** (`user.controller.ts`): lee la petición con `parsePagination` y `parseSearch` de `domain/dtos` y responde.
4. **Servicio** (`application/services/user/user.service.ts`): recibe los repositorios por constructor (interfaces de `domain/repository`) y aplica las reglas de `domain/policies/user`.
5. **Repositorio** (`infrastructure/repositories/user/user.repository.impl.ts`): cumple la interfaz y llama a su datasource. No tiene lógica.
6. **Datasource** (`infrastructure/datasources/user/user.datasource.postgres.ts`): consulta con Prisma y devuelve `{ items, total }`.

Para agregar una operación:
1. Método en la interfaz del datasource (`domain/datasources`) y en sus implementaciones (`infrastructure`).
2. Si tiene reglas, una función pura en `domain/policies/<módulo>/` con su prueba (`*.test.ts` al lado).
3. El servicio carga los datos y llama a la regla; lanza `CustomError` para lo que no se permite.
4. DTO en `domain/dtos/<módulo>/` si recibe un cuerpo o filtros.
5. Controlador y ruta en `presentation/routes/<módulo>/`; el builder en `presentation/dependencies`.
6. Prueba de integración en `tests/integration` para permisos, errores y la forma de la respuesta.

Los dispositivos pertenecen siempre a un proyecto y se administran bajo
`/api/proyectos/:proyectoId/dispositivos`. `DeviceService` valida los campos exclusivos de gateways y
terminales, la pertenencia del gateway y el ciclo de vida del token de enrolamiento; el datasource no
expone los hashes guardados.

Si un servicio necesita algo que no es un repositorio (mandar un correo, guardar un archivo, cobrar), se agrega una interfaz en `domain/ports` y su implementación en `infrastructure`; `presentation/dependencies` las conecta.

## Qué se puede importar

La regla `no-restricted-imports` de `eslint.config.mjs` lo revisa en cada `npm run lint`:

| Capa | No puede importar |
|---|---|
| `domain` | `application`, `infrastructure`, `api`, `presentation`, `generated`, ni `express`, Prisma, `nodemailer`, `jsonwebtoken` o `bcryptjs` |
| `application` | `infrastructure`, `api`, `presentation`, `generated`, ni `express`, Prisma o `nodemailer` |
| `infrastructure` | `application`, `api`, `presentation` |
| `api` | `presentation`, `infrastructure`, `generated` (recibe lo que necesita por parámetro) |
| `presentation` | todo está permitido: aquí se arman las dependencias |

`config` lo pueden usar todas. Las pruebas (`*.test.ts`, `tests/`) pueden importar lo que necesiten.

Otras reglas del lint: sin `any` (salvo pruebas), `import type` para lo que solo es tipo, sin variables sin usar y sin `console` (se usa `config/logger.ts`).

## Dónde va cada archivo

| Es… | Va en |
|---|---|
| Una regla de negocio sin datos externos | `domain/policies/<módulo>/` |
| La validación de un cuerpo, filtro o paginación | `domain/dtos/<módulo>/` |
| Un caso que carga datos y aplica reglas | `application/services/<módulo>/` |
| Una consulta a la base | `infrastructure/datasources/` |
| Algo que toca red, disco o un proveedor | `infrastructure/<tema>/`, con su interfaz en `domain/ports` |
| Un middleware de Express | `api/middlewares/` |
| Una ruta o controlador | `presentation/routes/<módulo>/` |
| Crear instancias (`new`) | `presentation/dependencies/` |

Los nombres de archivos y carpetas siguen [convencion-nombres.md](convencion-nombres.md); el formato de respuestas y errores, [contrato-api.md](contrato-api.md); cómo probar, [pruebas.md](pruebas.md).

## Autenticación y permisos

- El dashboard inicia sesión con `POST /api/auth/login` y manda el token en `Authorization: Bearer <token>`. El token solo lleva el id del usuario.
- `requireAuth` vuelve a leer el usuario y su perfil en **cada** petición: desactivar un usuario o su perfil corta el acceso de inmediato.
- `SUPER_ROLE` abre todos los módulos y no lleva perfil. `ADMIN_ROLE` abre solo los módulos de su perfil (`requireModules`). El perfil es global (los mismos módulos en todos sus proyectos).
- **Proyectos:** cada usuario pertenece a uno o varios proyectos (`SUPER_ROLE` los ve todos). La sesión trae `proyectos`, y todo lo de un proyecto cuelga de `/api/proyectos/:proyectoId/...` con `requireProjectAccess()`. Los servicios reciben un `Actor` (`sessionActor(req)`) con su `projectAccess` y aplican `domain/policies/project/project-access-policy.ts`: un admin solo ve y administra usuarios de sus proyectos. Lo que no puede ver responde 404, como si no existiera.
- Solo un super administrador puede crear, cambiar o eliminar a otro super administrador, y nadie puede desactivarse, cambiarse el rol o eliminarse a sí mismo (`domain/policies/user/user-management-policy.ts`).
- Los gateways (SCAT) no usan usuarios del dashboard: se enrolan con un token de un solo uso y luego operan con un **token operativo** (`Authorization: Bearer`, solo se guarda su SHA-256), que valida `api/middlewares/gateway/gateway-auth.middleware.ts`.
- **Presencia real:** el gateway siempre inicia la conexión (heartbeat, sin puertos abiertos). `GatewayService` guarda cada heartbeat y `DevicePresenceMonitor` (iniciado y detenido con el servidor) marca fuera de línea a quien supere `DEVICE_OFFLINE_AFTER_MS`. Nunca se muestra "En línea" sin heartbeat (`domain/policies/device/device-presence-policy.ts`).
- **Historial:** `dispositivo_eventos` es de solo inserción (token generado, enrolado, re-enrolado, conectado, desconectado, terminal detectada…), con el actor de la auditoría.
- **Cola de comandos:** `DeviceCommandService` encola en `dispositivo_comandos` lo que un cambio de terminal significa para su gateway (la decisión es pura, en `domain/policies/device/device-command-policy.ts`) y `GatewayService` la entrega en la respuesta del heartbeat y cierra cada comando con el resultado reportado. La entrega es optimista (`intentos` funciona como versión), así que dos heartbeats simultáneos no entregan el mismo comando. Detalle en `docs/contrato-api.md`, "Cola de comandos".
- **Terminales por MAC:** la lista que reporta el gateway es la verdad física: actualiza IP, presencia y gateway de las MAC conocidas y registra las nuevas. El heartbeat es ligero (cada 60 s, `intervaloSegundos` en la respuesta; terminales solo cuando cambian).

Excepciones conocidas: `server.ts` conecta la base al arrancar y `routes/health` consulta el estado de la conexión; ambos usan `PostgresDatabase` directamente porque ese es su propósito.

## Auditoría y trazabilidad

La trazabilidad es parte del dominio y no un detalle exclusivo de la interfaz. Toda entidad de negocio
debe conservar como mínimo quién y cuándo la creó, y quién y cuándo realizó su última modificación. Esta
regla aplica a usuarios, perfiles, proyectos, dispositivos, eventos, órdenes y especialmente boletos.

- Las escrituras autenticadas reciben el actor de la sesión; el cliente nunca decide la identidad del autor.
- Los procesos sin usuario se registran con un actor de sistema y se muestran como `Sistema`.
- La API expone la auditoría con nombres de contrato en español: `creadoPor`, `creadoEn`, `actualizadoPor`
  y `actualizadoEn`. Los actores públicos incluyen al menos `id` y `nombre`; nunca datos sensibles.
- La trazabilidad histórica no desaparece al desactivar, renombrar o eliminar lógicamente a un usuario.
- En boletos, validaciones, cancelaciones, reasignaciones y cambios de estado también deben quedar en un
  historial inmutable; no basta con conservar únicamente el último cambio.
- Las migraciones y servicios de cada módulo son responsables de guardar estos datos de manera atómica con
  la operación de negocio. Las pruebas de integración comprueban autor y fechas.
