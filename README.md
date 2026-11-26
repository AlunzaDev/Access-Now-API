# Access Now API

Backend de Access Now: eventos, boletos y validación para los scanners (SCAT). Node 22+, Express 5, Prisma 7 y PostgreSQL 17.

La base (capas, plugins, middlewares, Docker) viene de VIGGO ADMINISTRATIVO; ver [docs/arquitectura.md](docs/arquitectura.md).

## Desarrollo local

```bash
npm install
cp .env.example .env.dev            # y cambia JWT_SEED
docker compose up -d postgres        # Postgres en 127.0.0.1:5435 (crea también access_now_test)
npm run db:migrate                   # aplica las migraciones
npm run db:seed                      # crea el super admin (SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD)
npm run dev                          # http://localhost:3000
```

Sin `SEED_ADMIN_PASSWORD`, el seed genera una contraseña y la muestra una sola vez.

Sin `MAILER_*` la API funciona, pero no envía correos (recuperación de contraseña y, más adelante, boletos).

## Pruebas

```bash
cp .env.test.example .env.test
npm test
```

Las pruebas de integración usan la base `access_now_test` (el nombre debe terminar en `_test`) y aplican las migraciones antes de correr.

En Windows, corre `npm test` desde una ruta con la unidad en mayúscula (`C:\...`). Si la terminal abre la carpeta como `c:\...`, vitest carga sus módulos dos veces y falla con `Cannot read properties of undefined (reading 'config')`.

## Endpoints

| Método y ruta | Quién | Qué hace |
|---|---|---|
| `GET /api/ping`, `GET /api/health` | Público | Vida del servicio y estado de la base. |
| `POST /api/auth/login` | Público | `{ correo, password }` → `{ token, usuario }` (con `modules`). Limita los intentos fallidos. |
| `GET /api/auth/renew` | Sesión | Token nuevo y usuario actualizado. |
| `POST /api/auth/forgot-password` | Público | Manda el enlace de recuperación (misma respuesta exista o no la cuenta). |
| `GET/POST /api/auth/reset-password` | Público | Página y envío de la contraseña nueva. |
| `/api/usuarios` | Módulo `users` | CRUD de usuarios del dashboard. Eliminar: solo `SUPER_ROLE`. |
| `/api/permission-profiles` | Módulo `permissionProfiles` | CRUD de perfiles; `GET /modules` lista los módulos disponibles. Eliminar: solo `SUPER_ROLE`. |

Roles: `SUPER_ROLE` abre todo; `ADMIN_ROLE` abre los módulos de su perfil de permisos (`users`, `permissionProfiles`, `events`, `tickets`, `scanners`, `orders`).

## Docker (producción)

```bash
cp .env.docker.example .env.docker   # secretos reales
docker compose up -d --build         # postgres → migrate → backend en :8080
```
