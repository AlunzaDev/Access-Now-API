-- AlterEnum
ALTER TYPE "tipo_evento_boleto" ADD VALUE 'QR_CONSULTADO';

-- AlterTable
ALTER TABLE "boleto_credenciales" ADD COLUMN     "token_ciphertext" TEXT,
ADD COLUMN     "token_iv" TEXT,
ADD COLUMN     "token_tag" TEXT;
