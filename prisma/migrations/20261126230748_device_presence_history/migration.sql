-- CreateEnum
CREATE TYPE "tipo_evento_dispositivo" AS ENUM ('TOKEN_GENERADO', 'ENROLADO', 'REENROLADO', 'CONECTADO', 'DESCONECTADO', 'ENROLAMIENTO_VENCIDO', 'ERROR');

-- AlterTable
ALTER TABLE "dispositivos" ADD COLUMN     "en_linea" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "dispositivo_eventos" (
    "id" UUID NOT NULL,
    "dispositivo_id" UUID NOT NULL,
    "tipo" "tipo_evento_dispositivo" NOT NULL,
    "detalle" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_id" UUID,
    "actor_nombre" TEXT NOT NULL DEFAULT 'Sistema',

    CONSTRAINT "dispositivo_eventos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dispositivo_eventos_dispositivo_id_created_at_idx" ON "dispositivo_eventos"("dispositivo_id", "created_at");

-- AddForeignKey
ALTER TABLE "dispositivo_eventos" ADD CONSTRAINT "dispositivo_eventos_dispositivo_id_fkey" FOREIGN KEY ("dispositivo_id") REFERENCES "dispositivos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
