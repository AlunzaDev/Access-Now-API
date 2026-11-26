-- AlterTable
ALTER TABLE "dispositivos" ADD COLUMN     "device_fingerprint" TEXT,
ADD COLUMN     "device_token_hash" TEXT,
ADD COLUMN     "enrolled_at" TIMESTAMPTZ(3),
ADD COLUMN     "enrollment_expires_at" TIMESTAMPTZ(3);
