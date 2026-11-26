-- AlterTable
ALTER TABLE "dispositivos" ADD COLUMN     "actualizado_por_id" UUID,
ADD COLUMN     "actualizado_por_nombre" TEXT NOT NULL DEFAULT 'Sistema',
ADD COLUMN     "creado_por_id" UUID,
ADD COLUMN     "creado_por_nombre" TEXT NOT NULL DEFAULT 'Sistema';

-- AlterTable
ALTER TABLE "permission_profiles" ADD COLUMN     "actualizado_por_id" UUID,
ADD COLUMN     "actualizado_por_nombre" TEXT NOT NULL DEFAULT 'Sistema',
ADD COLUMN     "creado_por_id" UUID,
ADD COLUMN     "creado_por_nombre" TEXT NOT NULL DEFAULT 'Sistema';

-- AlterTable
ALTER TABLE "proyectos" ADD COLUMN     "actualizado_por_id" UUID,
ADD COLUMN     "actualizado_por_nombre" TEXT NOT NULL DEFAULT 'Sistema',
ADD COLUMN     "creado_por_id" UUID,
ADD COLUMN     "creado_por_nombre" TEXT NOT NULL DEFAULT 'Sistema';

-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "actualizado_por_id" UUID,
ADD COLUMN     "actualizado_por_nombre" TEXT NOT NULL DEFAULT 'Sistema',
ADD COLUMN     "creado_por_id" UUID,
ADD COLUMN     "creado_por_nombre" TEXT NOT NULL DEFAULT 'Sistema';
