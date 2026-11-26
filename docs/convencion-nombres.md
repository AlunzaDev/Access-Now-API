# Convención de nombres: español e inglés

La misma regla que COTIZA (`cotizapp-backend/docs/convencion-nombres.md`).

## En inglés

Todo lo que es código y solo leen los desarrolladores:

- Archivos y carpetas: `user.service.ts`, `session-policy.ts`.
- Clases, interfaces y tipos: `UserService`, `UserEntity`, `CreateUserDto`.
- Funciones, métodos y variables: `findByEmail`, `resolveSessionModules`.
- Constantes: `USER_MODULES`, `AUTH_ROLES`.
- Modelos de Prisma: `model User`, `model Role` (el nombre del modelo es código; la tabla la fija `@@map`).

## En español

Lo que es contrato con el frontend o con la base de datos, o lo que ve una persona:

- Rutas de la API: `/usuarios`, `/perfiles-permisos`, `/proyectos`.
- Campos del JSON de la API y de Prisma: `nombre`, `correo`, `estado`, `permissionProfileId`.
- Query params: `desde`, `limite`, `buscar`.
- Tablas y columnas: `usuarios`, `permission_profiles`, `created_at` (snake_case con `@@map`/`@map`).
- Mensajes de error y textos para el usuario: `"El correo ya está registrado"`.
- Comentarios del código que expliquen negocio, commits, issues y documentación. Los comentarios técnicos pueden ir en inglés.

## Lo que no se cambia

- **Campos y rutas del contrato.** No se renombran sin avisar al frontend; uno que quedó en inglés (`permissionProfileId`, `modules`, `/auth/login`) se queda así.
- **Valores de catálogo guardados**: roles (`SUPER_ROLE`, `ADMIN_ROLE`) y módulos (`users`, `events`, …). Cambiarlos requiere una migración de datos.
- **Nombres de tablas y columnas.** Cambiar un modelo de Prisma no los toca porque los fija `@@map`/`@map`.

## Archivos y carpetas

Todo en kebab-case: `create-user.dto.ts`, `permission-profile/`, `reset-password-page-html.ts`. Sin camelCase, PascalCase ni guion bajo.

Sufijos por tipo: `.entity.ts`, `.dto.ts`, `.datasource.ts`, `.datasource.postgres.ts`, `.repository.ts`, `.repository.impl.ts`, `.service.ts`, `.controller.ts`, `.routes.ts`, `.port.ts`, `-policy.ts`, `.test.ts`.

## Orden de carpetas: tipo / módulo / archivo

Primero la capa y el tipo, luego el módulo (una carpeta por módulo, aunque tenga un solo archivo) y al final el archivo. Cada tipo tiene un `index.ts` que exporta todo lo de sus módulos. Nunca al revés (`user/dtos/...`) ni archivos sueltos de un módulo directo en el tipo.

```
domain/entities/user/user.entity.ts                         tipo / módulo / archivo
domain/entities/index.ts                                    exporta todos los módulos
domain/datasources/user/user.datasource.ts
domain/repository/user/user.repository.ts
domain/dtos/user/create-user.dto.ts
domain/policies/auth/session-policy.ts (+ session-policy.test.ts)
domain/ports/email/email-sender.port.ts
application/services/user/user.service.ts
infrastructure/datasources/user/user.datasource.postgres.ts
infrastructure/repositories/user/user.repository.impl.ts
api/middlewares/auth/auth.middleware.ts
presentation/routes/user/user.controller.ts, user.routes.ts
```

Un módulo nuevo (por ejemplo `project`) agrega su carpeta en cada tipo que use y su línea en el `index.ts` de ese tipo. Lo transversal sin módulo (`domain/errors`, `domain/helpers`, `config`, `infrastructure/prisma`) va directo en su carpeta.

## Cómo mover o renombrar

Con `git mv`, para conservar el historial, y actualizando todos los imports en el mismo commit. `npm run typecheck` falla si queda uno roto.
