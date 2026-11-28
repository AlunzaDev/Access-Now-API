-- Physical venue catalog. A terminal is the lane; doors group terminals and grant access to zones.
CREATE TABLE "proyecto_zonas" (
  "id" UUID NOT NULL, "proyecto_id" UUID NOT NULL, "nombre" TEXT NOT NULL,
  "descripcion" TEXT NOT NULL DEFAULT '', "estado" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  "creado_por_id" UUID, "creado_por_nombre" TEXT NOT NULL DEFAULT 'Sistema',
  "actualizado_por_id" UUID, "actualizado_por_nombre" TEXT NOT NULL DEFAULT 'Sistema',
  CONSTRAINT "proyecto_zonas_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "proyecto_secciones" (
  "id" UUID NOT NULL, "zona_id" UUID NOT NULL, "nombre" TEXT NOT NULL,
  "descripcion" TEXT NOT NULL DEFAULT '', "estado" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  "creado_por_id" UUID, "creado_por_nombre" TEXT NOT NULL DEFAULT 'Sistema',
  "actualizado_por_id" UUID, "actualizado_por_nombre" TEXT NOT NULL DEFAULT 'Sistema',
  CONSTRAINT "proyecto_secciones_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "proyecto_filas" (
  "id" UUID NOT NULL, "seccion_id" UUID NOT NULL, "nombre" TEXT NOT NULL,
  "estado" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  "creado_por_id" UUID, "creado_por_nombre" TEXT NOT NULL DEFAULT 'Sistema',
  "actualizado_por_id" UUID, "actualizado_por_nombre" TEXT NOT NULL DEFAULT 'Sistema',
  CONSTRAINT "proyecto_filas_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "proyecto_asientos" (
  "id" UUID NOT NULL, "fila_id" UUID NOT NULL, "nombre" TEXT NOT NULL,
  "estado" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  "creado_por_id" UUID, "creado_por_nombre" TEXT NOT NULL DEFAULT 'Sistema',
  "actualizado_por_id" UUID, "actualizado_por_nombre" TEXT NOT NULL DEFAULT 'Sistema',
  CONSTRAINT "proyecto_asientos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "proyecto_puertas" (
  "id" UUID NOT NULL, "proyecto_id" UUID NOT NULL, "nombre" TEXT NOT NULL,
  "descripcion" TEXT NOT NULL DEFAULT '', "estado" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  "creado_por_id" UUID, "creado_por_nombre" TEXT NOT NULL DEFAULT 'Sistema',
  "actualizado_por_id" UUID, "actualizado_por_nombre" TEXT NOT NULL DEFAULT 'Sistema',
  CONSTRAINT "proyecto_puertas_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "proyecto_puerta_zonas" (
  "puerta_id" UUID NOT NULL, "zona_id" UUID NOT NULL,
  CONSTRAINT "proyecto_puerta_zonas_pkey" PRIMARY KEY ("puerta_id", "zona_id")
);

CREATE TABLE "evento_zonas" (
  "evento_id" UUID NOT NULL, "zona_id" UUID NOT NULL, "capacidad" INTEGER,
  CONSTRAINT "evento_zonas_pkey" PRIMARY KEY ("evento_id", "zona_id")
);

ALTER TABLE "boletos"
  ADD COLUMN "zona_id" UUID, ADD COLUMN "seccion_id" UUID,
  ADD COLUMN "fila_id" UUID, ADD COLUMN "asiento_id" UUID, ADD COLUMN "puerta_id" UUID,
  ADD COLUMN "zona_nombre" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "seccion_nombre" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "fila_nombre" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "asiento_nombre" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "puerta_nombre" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "emitido_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "vendido_en" TIMESTAMPTZ(3);

ALTER TABLE "dispositivos" ADD COLUMN "puerta_id" UUID;

-- Preserve existing lane labels as project doors before removing the duplicated free-text field.
INSERT INTO "proyecto_puertas" (
  "id", "proyecto_id", "nombre", "updated_at", "creado_por_nombre", "actualizado_por_nombre"
)
SELECT gen_random_uuid(), "proyecto_id", trim("carril"), CURRENT_TIMESTAMP, 'Migración', 'Migración'
FROM "dispositivos"
WHERE "tipo" = 'TERMINAL' AND NULLIF(trim("carril"), '') IS NOT NULL
GROUP BY "proyecto_id", trim("carril")
ON CONFLICT DO NOTHING;

UPDATE "dispositivos" AS dispositivo
SET "puerta_id" = puerta."id"
FROM "proyecto_puertas" AS puerta
WHERE puerta."proyecto_id" = dispositivo."proyecto_id"
  AND puerta."nombre" = trim(dispositivo."carril");

ALTER TABLE "dispositivos" DROP COLUMN "carril";

CREATE UNIQUE INDEX "proyecto_zonas_proyecto_id_nombre_key" ON "proyecto_zonas"("proyecto_id", "nombre");
CREATE UNIQUE INDEX "proyecto_secciones_zona_id_nombre_key" ON "proyecto_secciones"("zona_id", "nombre");
CREATE UNIQUE INDEX "proyecto_filas_seccion_id_nombre_key" ON "proyecto_filas"("seccion_id", "nombre");
CREATE UNIQUE INDEX "proyecto_asientos_fila_id_nombre_key" ON "proyecto_asientos"("fila_id", "nombre");
CREATE UNIQUE INDEX "proyecto_puertas_proyecto_id_nombre_key" ON "proyecto_puertas"("proyecto_id", "nombre");
CREATE INDEX "dispositivos_puerta_id_idx" ON "dispositivos"("puerta_id");

ALTER TABLE "proyecto_zonas" ADD CONSTRAINT "proyecto_zonas_proyecto_id_fkey"
  FOREIGN KEY ("proyecto_id") REFERENCES "proyectos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "proyecto_secciones" ADD CONSTRAINT "proyecto_secciones_zona_id_fkey"
  FOREIGN KEY ("zona_id") REFERENCES "proyecto_zonas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "proyecto_filas" ADD CONSTRAINT "proyecto_filas_seccion_id_fkey"
  FOREIGN KEY ("seccion_id") REFERENCES "proyecto_secciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "proyecto_asientos" ADD CONSTRAINT "proyecto_asientos_fila_id_fkey"
  FOREIGN KEY ("fila_id") REFERENCES "proyecto_filas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "proyecto_puertas" ADD CONSTRAINT "proyecto_puertas_proyecto_id_fkey"
  FOREIGN KEY ("proyecto_id") REFERENCES "proyectos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "proyecto_puerta_zonas" ADD CONSTRAINT "proyecto_puerta_zonas_puerta_id_fkey"
  FOREIGN KEY ("puerta_id") REFERENCES "proyecto_puertas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "proyecto_puerta_zonas" ADD CONSTRAINT "proyecto_puerta_zonas_zona_id_fkey"
  FOREIGN KEY ("zona_id") REFERENCES "proyecto_zonas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "evento_zonas" ADD CONSTRAINT "evento_zonas_evento_id_fkey"
  FOREIGN KEY ("evento_id") REFERENCES "eventos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "evento_zonas" ADD CONSTRAINT "evento_zonas_zona_id_fkey"
  FOREIGN KEY ("zona_id") REFERENCES "proyecto_zonas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "dispositivos" ADD CONSTRAINT "dispositivos_puerta_id_fkey"
  FOREIGN KEY ("puerta_id") REFERENCES "proyecto_puertas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "boletos" ADD CONSTRAINT "boletos_zona_id_fkey"
  FOREIGN KEY ("zona_id") REFERENCES "proyecto_zonas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "boletos" ADD CONSTRAINT "boletos_seccion_id_fkey"
  FOREIGN KEY ("seccion_id") REFERENCES "proyecto_secciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "boletos" ADD CONSTRAINT "boletos_fila_id_fkey"
  FOREIGN KEY ("fila_id") REFERENCES "proyecto_filas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "boletos" ADD CONSTRAINT "boletos_asiento_id_fkey"
  FOREIGN KEY ("asiento_id") REFERENCES "proyecto_asientos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "boletos" ADD CONSTRAINT "boletos_puerta_id_fkey"
  FOREIGN KEY ("puerta_id") REFERENCES "proyecto_puertas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
