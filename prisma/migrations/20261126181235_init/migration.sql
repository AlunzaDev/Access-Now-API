-- CreateEnum
CREATE TYPE "user_module" AS ENUM ('users', 'permissionProfiles', 'events', 'tickets', 'scanners', 'orders');

-- CreateTable
CREATE TABLE "roles" (
    "code" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL DEFAULT '',
    "sistema" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "correo" TEXT NOT NULL,
    "telefono" TEXT NOT NULL DEFAULT '',
    "password" TEXT NOT NULL,
    "password_reset_token_hash" TEXT,
    "password_reset_expires_at" TIMESTAMPTZ(3),
    "rol" TEXT NOT NULL DEFAULT 'ADMIN_ROLE',
    "permission_profile_id" UUID,
    "img" TEXT NOT NULL DEFAULT '',
    "estado" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permission_profiles" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL DEFAULT '',
    "modules" "user_module"[] DEFAULT ARRAY[]::"user_module"[],
    "estado" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "permission_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_correo_key" ON "usuarios"("correo");

-- CreateIndex
CREATE INDEX "usuarios_rol_idx" ON "usuarios"("rol");

-- CreateIndex
CREATE INDEX "usuarios_permission_profile_id_idx" ON "usuarios"("permission_profile_id");

-- CreateIndex
CREATE UNIQUE INDEX "permission_profiles_nombre_key" ON "permission_profiles"("nombre");

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_rol_fkey" FOREIGN KEY ("rol") REFERENCES "roles"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_permission_profile_id_fkey" FOREIGN KEY ("permission_profile_id") REFERENCES "permission_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- System roles (seed data; the API relies on them).
INSERT INTO "roles" ("code", "nombre", "descripcion", "sistema", "updated_at") VALUES
  ('SUPER_ROLE', 'Super administrador', 'Acceso total, incluida la gestión de otros super administradores', true, CURRENT_TIMESTAMP),
  ('ADMIN_ROLE', 'Administrador', 'Acceso a los módulos de su perfil de permisos', true, CURRENT_TIMESTAMP);
