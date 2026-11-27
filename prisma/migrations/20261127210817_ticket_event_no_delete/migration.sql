-- DropForeignKey
ALTER TABLE "boletos" DROP CONSTRAINT "boletos_evento_id_fkey";

-- AddForeignKey
ALTER TABLE "boletos" ADD CONSTRAINT "boletos_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "eventos"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
