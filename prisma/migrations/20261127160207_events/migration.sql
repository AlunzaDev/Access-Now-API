-- CreateTable
CREATE TABLE "eventos" (
    "id" UUID NOT NULL,
    "proyecto_id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL DEFAULT '',
    "img" TEXT NOT NULL DEFAULT '',
    "fecha_inicio" DATE NOT NULL,
    "fecha_fin" DATE NOT NULL,
    "hora_inicio" TEXT NOT NULL,
    "hora_fin" TEXT NOT NULL,
    "estado" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "creado_por_id" UUID,
    "creado_por_nombre" TEXT NOT NULL DEFAULT 'Sistema',
    "actualizado_por_id" UUID,
    "actualizado_por_nombre" TEXT NOT NULL DEFAULT 'Sistema',

    CONSTRAINT "eventos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "eventos_proyecto_id_fecha_inicio_idx" ON "eventos"("proyecto_id", "fecha_inicio");

-- AddForeignKey
ALTER TABLE "eventos" ADD CONSTRAINT "eventos_proyecto_id_fkey" FOREIGN KEY ("proyecto_id") REFERENCES "proyectos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
