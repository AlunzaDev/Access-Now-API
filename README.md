# Access Now API

Backend de Access Now: eventos, boletos y validación para los scanners (SCAT). Node 22+, Express 5, Prisma 7 y PostgreSQL 17.

La base viene de VIGGO ADMINISTRATIVO y las reglas de calidad y arquitectura de COTIZA; ver [docs/arquitectura.md](docs/arquitectura.md).

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

## Calidad

```bash
cp .env.test.example .env.test
npm run verify        # typecheck + lint + pruebas (unitarias e integración)
```

- Arquitectura y reglas de capas: [docs/arquitectura.md](docs/arquitectura.md)
- Nombres: [docs/convencion-nombres.md](docs/convencion-nombres.md)
- Contrato (errores, paginación, endpoints): [docs/contrato-api.md](docs/contrato-api.md)
- Pruebas: [docs/pruebas.md](docs/pruebas.md)

En Windows, corre las pruebas desde una ruta con la unidad en mayúscula (`C:\...`); ver docs/pruebas.md.

## Docker (producción)

```bash
cp .env.docker.example .env.docker   # secretos reales
docker compose up -d --build         # postgres → migrate → backend en :8080
```
