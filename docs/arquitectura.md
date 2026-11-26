# Arquitectura del código

Cómo se organiza `src/` y qué va en cada capa. Es la misma estructura de VIGGO ADMINISTRATIVO, de donde se tomó la base. Si algo no encaja en estas reglas, se discute y se documenta aquí antes de hacer una excepción.

## Capas

```text
routes → controller → service → repository → datasource → PostgreSQL
                         ↑            ↑            ↑
                      domain (entidades, DTOs, contratos abstractos, errores)
```

| Carpeta | Qué va | Qué **no** va |
|---|---|---|
| `domain/entities`, `domain/dtos` | Entidades y validación de entrada (`XDto.create(body) → [error, dto]`). | Express, Prisma, `fs`, variables de entorno. |
| `domain/datasources`, `domain/repositories` | Contratos abstractos: qué datos se leen y escriben, con tipos del dominio. | Implementaciones. |
| `domain/constants` | Roles (`SUPER_ROLE`, `ADMIN_ROLE`) y módulos del dashboard. | — |
| `domain/errors`, `domain/helpers` | `CustomError` y utilidades puras (por ejemplo `isUuid`). | — |
| `infrastructure/datasources` | Implementación con Prisma de cada datasource. Convierte filas en entidades. | Reglas de negocio; imports de `presentation/`. |
| `infrastructure/repositories` | Implementación del repositorio: delega en el datasource. | Lógica (ver "Repositorios"). |
| `presentation/services` | **Toda** la lógica de negocio: reglas, validaciones de estado, orquestación de repositorios. Lanza `CustomError`. | `req`/`res`, Prisma, `PostgresDatabase`. |
| `presentation/routes/<módulo>/*.controller.ts` | HTTP: lee el request, arma el DTO, llama al servicio y responde. | Reglas de negocio, consultas a la base. |
| `presentation/routes/<módulo>/*.routes.ts` | Solo rutas y middlewares (`router.get("/", auth, controller.list)`). | Handlers, `new` de clases, consultas. |
| `presentation/dependencies` | Único lugar donde se crean (`new`) datasources, repositorios, servicios y controllers: `buildXController()`. `repositories.dependencies.ts` solo importa de `infrastructure/`. | Lógica. |
| `presentation/middlewares` | Autenticación, permisos, límites de intentos. Solo importan de `repositories.dependencies` (los controllers importan el middleware; importar los builders de controllers sería un ciclo). | — |
| `config/plugins` | Adaptadores de librerías usadas por varias capas: JWT, bcrypt, variables de entorno. | Reglas de negocio. |

Dirección de dependencias: `presentation → domain ← infrastructure`. El dominio no importa nada de las otras capas; `infrastructure` no importa de `presentation`.

## Un controller "bien"

```ts
create = async (req: Request, res: Response) => {
  try {
    const [error, dto] = CreateUsuarioDto.create(req.body ?? {});
    if (error) return res.status(400).json({ error });
    return res.status(201).json({ usuario: await this.usuarioService.create(dto!) });
  } catch (error) {
    return ErrorService.handleApiError(error, res);
  }
};
```

- Las reglas ("un administrador necesita un perfil activo", "no puedes eliminar tu propia cuenta") viven en el servicio y se expresan con `CustomError.conflict(...)`, `CustomError.badRequest(...)`, etc.
- `ErrorService.handleApiError` traduce el error al código HTTP y al formato común `{ error, code, details }`. Un error inesperado responde 500 sin detalles internos.

## Autenticación y permisos

- El dashboard inicia sesión con `POST /api/auth/login` (`correo`, `password`) y manda el token en `Authorization: Bearer <token>`. El token solo lleva el id del usuario.
- `AuthMiddleware.requireAuth` vuelve a leer el usuario y su perfil en **cada** petición (`SessionResolver`): desactivar un usuario o su perfil corta el acceso de inmediato, sin esperar a que el token expire.
- `SUPER_ROLE` abre todos los módulos y no lleva perfil. `ADMIN_ROLE` abre solo los módulos de su perfil (`requireModules("events")`, etc.).
- Solo un super administrador puede crear, cambiar o eliminar a otro super administrador (`protectSuperUser`).
- Los scanners (SCAT) tendrán su propia autenticación por dispositivo (#7); no usan usuarios del dashboard.

## Repositorios

Hoy solo reenvían al datasource. Se conservan para que un servicio dependa de un contrato del dominio y no de una implementación. Regla: **un repositorio no tiene lógica**; si algo decide, va en el servicio.

## Módulo nuevo: lista de verificación

1. Entidad y DTOs en `domain/`, con su validación.
2. Contrato del datasource (y del repositorio) en `domain/`.
3. Implementación en `infrastructure/`.
4. Servicio en `presentation/services/<módulo>` con las reglas.
5. Controller y routes en `presentation/routes/<módulo>`; montar en `routes/routes.ts`.
6. `buildXController()` en `presentation/dependencies`.
7. Si es una sección del dashboard: agregar el módulo a `enum UserModule` (schema) y a `domain/constants/user-modules.ts`.
8. Pruebas de integración con PostgreSQL real (`tests/integration`) para las reglas del servicio y los permisos de las rutas.

Excepciones conocidas: `server.ts` conecta la base al arrancar y `routes/health` consulta el estado de la conexión; ambos usan `PostgresDatabase` directamente porque ese es su propósito.
