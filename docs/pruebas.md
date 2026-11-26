# Pruebas

Todo corre con vitest (`npm test`).

| Tipo | Dónde | Qué prueba |
|---|---|---|
| Unitarias | `src/**/*.test.ts`, junto al archivo | Reglas puras: `domain/policies`, DTOs, paginación. No tocan la base. |
| Integración | `tests/integration/*.test.ts` | La API por HTTP contra PostgreSQL real: permisos, errores, forma de las respuestas. |

## Requisitos

- `docker compose up -d postgres` (crea también la base `access_now_test`).
- `cp .env.test.example .env.test`. El nombre de la base debe terminar en `_test`; `tests/setup/global-setup.ts` se niega a correr contra otra y aplica las migraciones antes de empezar.
- En Windows, correr desde una ruta con `C:\` en mayúscula: si la terminal abre la carpeta como `c:\...`, vitest carga sus módulos dos veces y falla con `Cannot read properties of undefined (reading 'config')`.

## Cuándo correr qué

1. **Siempre:** `npm run verify` (typecheck + lint + pruebas).
2. **Reglas nuevas:** una prueba unitaria por regla en `domain/policies/<módulo>/<regla>.test.ts`.
3. **Rutas, permisos, DTOs o formato de respuesta:** una prueba de integración que cubra el caso feliz, los errores (`ok: false`, `statusCode`) y quién puede y quién no.

## Escribir una prueba de integración

- Monta `AppRoutes.routes` en un Express propio sobre un puerto libre (ver `auth-users-profiles.test.ts`).
- Marca lo que crea con una etiqueta única (`tag`) y bórralo en `afterAll`: las pruebas comparten la base y corren una por archivo.
- Verifica errores con el contrato completo (`expectApiError`), no solo el estado.
