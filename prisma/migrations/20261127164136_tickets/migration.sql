-- CreateEnum
CREATE TYPE "estado_venta_boleto" AS ENUM ('DISPONIBLE', 'RESERVADO', 'VENDIDO', 'CANCELADO', 'REEMBOLSADO');

-- CreateEnum
CREATE TYPE "tipo_evento_boleto" AS ENUM ('GENERADO', 'ASIGNADO', 'RESERVADO', 'VENDIDO', 'REASIGNADO', 'VALIDADO', 'ACCESO_CONCEDIDO', 'ACCESO_RECHAZADO', 'CANCELADO', 'REEMBOLSADO', 'QR_REEMITIDO');

-- AlterTable
ALTER TABLE "eventos" ADD COLUMN     "capacidad" INTEGER,
ADD COLUMN     "zona_horaria" TEXT NOT NULL DEFAULT 'America/Mexico_City';

-- CreateTable
CREATE TABLE "boletos" (
    "id" UUID NOT NULL,
    "proyecto_id" UUID NOT NULL,
    "evento_id" UUID NOT NULL,
    "folio" TEXT NOT NULL,
    "estado_venta" "estado_venta_boleto" NOT NULL DEFAULT 'DISPONIBLE',
    "titular_nombre" TEXT NOT NULL DEFAULT '',
    "titular_correo" TEXT NOT NULL DEFAULT '',
    "titular_telefono" TEXT NOT NULL DEFAULT '',
    "usado_en" TIMESTAMPTZ(3),
    "cancelado_en" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "creado_por_id" UUID,
    "creado_por_nombre" TEXT NOT NULL DEFAULT 'Sistema',
    "actualizado_por_id" UUID,
    "actualizado_por_nombre" TEXT NOT NULL DEFAULT 'Sistema',

    CONSTRAINT "boletos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boleto_credenciales" (
    "id" UUID NOT NULL,
    "boleto_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "emitido_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revocado_en" TIMESTAMPTZ(3),

    CONSTRAINT "boleto_credenciales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boleto_eventos" (
    "id" UUID NOT NULL,
    "boleto_id" UUID NOT NULL,
    "terminal_id" UUID,
    "tipo" "tipo_evento_boleto" NOT NULL,
    "detalle" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_id" UUID,
    "actor_nombre" TEXT NOT NULL DEFAULT 'Sistema',

    CONSTRAINT "boleto_eventos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "boletos_folio_key" ON "boletos"("folio");

-- CreateIndex
CREATE INDEX "boletos_proyecto_id_evento_id_estado_venta_idx" ON "boletos"("proyecto_id", "evento_id", "estado_venta");

-- CreateIndex
CREATE INDEX "boletos_evento_id_created_at_idx" ON "boletos"("evento_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "boleto_credenciales_token_hash_key" ON "boleto_credenciales"("token_hash");

-- CreateIndex
CREATE INDEX "boleto_credenciales_boleto_id_emitido_en_idx" ON "boleto_credenciales"("boleto_id", "emitido_en");

-- CreateIndex
CREATE INDEX "boleto_eventos_boleto_id_created_at_idx" ON "boleto_eventos"("boleto_id", "created_at");

-- AddForeignKey
ALTER TABLE "boletos" ADD CONSTRAINT "boletos_proyecto_id_fkey" FOREIGN KEY ("proyecto_id") REFERENCES "proyectos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boletos" ADD CONSTRAINT "boletos_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "eventos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boleto_credenciales" ADD CONSTRAINT "boleto_credenciales_boleto_id_fkey" FOREIGN KEY ("boleto_id") REFERENCES "boletos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boleto_eventos" ADD CONSTRAINT "boleto_eventos_boleto_id_fkey" FOREIGN KEY ("boleto_id") REFERENCES "boletos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
