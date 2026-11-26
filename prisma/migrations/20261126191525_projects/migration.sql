-- AlterEnum
ALTER TYPE "user_module" ADD VALUE 'projects';

-- CreateTable
CREATE TABLE "proyectos" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL DEFAULT '',
    "direccion" TEXT NOT NULL DEFAULT '',
    "ciudad" TEXT NOT NULL DEFAULT '',
    "img" TEXT NOT NULL DEFAULT '',
    "estado" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "proyectos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario_proyectos" (
    "usuario_id" UUID NOT NULL,
    "proyecto_id" UUID NOT NULL,

    CONSTRAINT "usuario_proyectos_pkey" PRIMARY KEY ("usuario_id","proyecto_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "proyectos_clave_key" ON "proyectos"("clave");

-- CreateIndex
CREATE INDEX "usuario_proyectos_proyecto_id_idx" ON "usuario_proyectos"("proyecto_id");

-- AddForeignKey
ALTER TABLE "usuario_proyectos" ADD CONSTRAINT "usuario_proyectos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_proyectos" ADD CONSTRAINT "usuario_proyectos_proyecto_id_fkey" FOREIGN KEY ("proyecto_id") REFERENCES "proyectos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
