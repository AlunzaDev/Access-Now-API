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
- Solo un super administrador puede crear, cambiar o eliminar a otro super administrador, y nadie puede desactivarse, cambiarse el rol o eliminarse a sí mismo (`domain/policies/user/user-management-policy.ts`).
- Los scanners (SCAT) tendrán su propia autenticación por dispositivo (#7); no usan usuarios del dashboard.

Excepciones conocidas: `server.ts` conecta la base al arrancar y `routes/health` consulta el estado de la conexión; ambos usan `PostgresDatabase` directamente porque ese es su propósito.
