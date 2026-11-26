-- CreateEnum
CREATE TYPE "tipo_comando_dispositivo" AS ENUM ('CONFIGURAR_TERMINAL', 'ELIMINAR_TERMINAL', 'SINCRONIZAR');

-- CreateEnum
CREATE TYPE "estado_comando_dispositivo" AS ENUM ('PENDIENTE', 'ENTREGADO', 'APLICADO', 'ERROR', 'CANCELADO');

-- AlterEnum
ALTER TYPE "estado_configuracion_dispositivo" ADD VALUE 'RETIRADA';

-- AlterEnum
ALTER TYPE "tipo_evento_dispositivo" ADD VALUE 'TERMINAL_DETECTADA';

-- CreateTable
CREATE TABLE "dispositivo_comandos" (
    "id" UUID NOT NULL,
    "gateway_id" UUID NOT NULL,
    "terminal_id" UUID,
    "tipo" "tipo_comando_dispositivo" NOT NULL,
    "estado" "estado_comando_dispositivo" NOT NULL DEFAULT 'PENDIENTE',
    "payload" JSONB NOT NULL DEFAULT '{}',
    "resultado" JSONB NOT NULL DEFAULT '{}',
    "error" TEXT NOT NULL DEFAULT '',
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "entregado_en" TIMESTAMPTZ(3),
    "finalizado_en" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creado_por_id" UUID,
    "creado_por_nombre" TEXT NOT NULL DEFAULT 'Sistema',

    CONSTRAINT "dispositivo_comandos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dispositivo_comandos_gateway_id_estado_created_at_idx" ON "dispositivo_comandos"("gateway_id", "estado", "created_at");

-- CreateIndex
CREATE INDEX "dispositivo_comandos_terminal_id_created_at_idx" ON "dispositivo_comandos"("terminal_id", "created_at");

-- AddForeignKey
ALTER TABLE "dispositivo_comandos" ADD CONSTRAINT "dispositivo_comandos_gateway_id_fkey" FOREIGN KEY ("gateway_id") REFERENCES "dispositivos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispositivo_comandos" ADD CONSTRAINT "dispositivo_comandos_terminal_id_fkey" FOREIGN KEY ("terminal_id") REFERENCES "dispositivos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
