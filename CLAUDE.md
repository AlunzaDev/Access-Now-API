# Access-Now-API

Backend de Access Now: proyectos, eventos, boletos y validación para los scanners (SCAT). Node + Express 5 + Prisma 7 + PostgreSQL.

Antes de escribir código, sigue estas guías; son obligatorias y el lint revisa parte de ellas:

- [docs/arquitectura.md](docs/arquitectura.md): capas, qué puede importar cada una y dónde va cada archivo.
- [docs/convencion-nombres.md](docs/convencion-nombres.md): código en inglés, contrato (rutas, campos, mensajes) en español, kebab-case.
- [docs/contrato-api.md](docs/contrato-api.md): formato de errores `{ ok, message, statusCode, details }`, listados `{ items, total }` con `desde`/`limite`, validaciones compartidas y tabla de endpoints.
- [docs/pruebas.md](docs/pruebas.md): qué pruebas escribir y cuándo correrlas.

Reglas rápidas:

- Carpetas en orden **tipo / módulo / archivo** (`domain/entities/user/user.entity.ts`), una carpeta por módulo y un `index.ts` por tipo que exporta todo (docs/convencion-nombres.md).
- Reglas de negocio en `domain/policies/<módulo>/` con su `*.test.ts`; los servicios solo orquestan.
- `new` de servicios, middlewares y controladores solo en `presentation/dependencies`.
- Errores con `CustomError` en servicios y `ErrorService` en controladores; nunca `res.json({ error })`.
- Sin `any`, sin `console` (usa `config/logger.ts`).
- Endpoint nuevo o cambiado: actualiza la tabla de `docs/contrato-api.md` y su prueba de integración en el mismo commit.
- Antes de dar algo por terminado: `npm run verify` en verde (desde `C:\` en mayúscula en Windows).
- Cambios de esquema: `npm run db:migrate -- --name <cambio>` y revisa el SQL generado antes de commitear.
