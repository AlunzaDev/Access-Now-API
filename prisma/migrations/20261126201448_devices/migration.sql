-- CreateEnum
CREATE TYPE "tipo_dispositivo" AS ENUM ('GATEWAY', 'TERMINAL');

-- CreateEnum
CREATE TYPE "sentido_dispositivo" AS ENUM ('ENTRADA', 'SALIDA');

-- CreateEnum
CREATE TYPE "estado_configuracion_dispositivo" AS ENUM ('PENDIENTE', 'CONFIGURADA', 'ERROR');

-- CreateTable
CREATE TABLE "dispositivos" (
    "id" UUID NOT NULL,
    "proyecto_id" UUID NOT NULL,
    "tipo" "tipo_dispositivo" NOT NULL,
    "nombre" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "mac" TEXT,
    "modelo" TEXT NOT NULL DEFAULT '',
    "estado" BOOLEAN NOT NULL DEFAULT true,
    "gateway_id" UUID,
    "carril" TEXT,
    "sentido" "sentido_dispositivo",
    "config_estado" "estado_configuracion_dispositivo" NOT NULL DEFAULT 'PENDIENTE',
    "config_error" TEXT NOT NULL DEFAULT '',
    "url_remota" TEXT NOT NULL DEFAULT '',
    "version" TEXT NOT NULL DEFAULT '',
    "ultima_conexion" TIMESTAMPTZ(3),
    "enrollment_token_hash" TEXT,
    "enrollment_token_expires_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "dispositivos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dispositivos_proyecto_id_tipo_idx" ON "dispositivos"("proyecto_id", "tipo");

-- CreateIndex
CREATE INDEX "dispositivos_gateway_id_idx" ON "dispositivos"("gateway_id");

-- CreateIndex
CREATE UNIQUE INDEX "dispositivos_proyecto_id_mac_key" ON "dispositivos"("proyecto_id", "mac");

-- AddForeignKey
ALTER TABLE "dispositivos" ADD CONSTRAINT "dispositivos_proyecto_id_fkey" FOREIGN KEY ("proyecto_id") REFERENCES "proyectos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispositivos" ADD CONSTRAINT "dispositivos_gateway_id_fkey" FOREIGN KEY ("gateway_id") REFERENCES "dispositivos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
