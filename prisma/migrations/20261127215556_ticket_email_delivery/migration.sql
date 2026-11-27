-- CreateEnum
CREATE TYPE "estado_envio_boleto" AS ENUM ('NO_ENVIADO', 'ENVIADO', 'ERROR');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "tipo_evento_boleto" ADD VALUE 'ENVIADO';
ALTER TYPE "tipo_evento_boleto" ADD VALUE 'ENVIO_FALLIDO';

-- AlterTable
ALTER TABLE "boletos" ADD COLUMN     "enviado_a" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "enviado_en" TIMESTAMPTZ(3),
ADD COLUMN     "estado_envio" "estado_envio_boleto" NOT NULL DEFAULT 'NO_ENVIADO';

-- CreateTable
CREATE TABLE "boleto_envios" (
    "id" UUID NOT NULL,
    "boleto_id" UUID NOT NULL,
    "correo" TEXT NOT NULL,
    "estado" "estado_envio_boleto" NOT NULL,
    "error" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_id" UUID,
    "actor_nombre" TEXT NOT NULL DEFAULT 'Sistema',

    CONSTRAINT "boleto_envios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "boleto_envios_boleto_id_created_at_idx" ON "boleto_envios"("boleto_id", "created_at");

-- AddForeignKey
ALTER TABLE "boleto_envios" ADD CONSTRAINT "boleto_envios_boleto_id_fkey" FOREIGN KEY ("boleto_id") REFERENCES "boletos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
