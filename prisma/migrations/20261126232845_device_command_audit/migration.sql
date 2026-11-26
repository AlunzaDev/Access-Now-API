/*
  Warnings:

  - Added the required column `updated_at` to the `dispositivo_comandos` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "dispositivo_comandos" ADD COLUMN     "actualizado_por_id" UUID,
ADD COLUMN     "actualizado_por_nombre" TEXT NOT NULL DEFAULT 'Sistema',
ADD COLUMN     "updated_at" TIMESTAMPTZ(3) NOT NULL;
