import { describe, expect, it } from "vitest";
import { USER_MODULES } from "../../constants";
import { PermissionProfileEntity } from "../../entities/permission-profile.entity";
import { UserEntity } from "../../entities/user.entity";
import { canOpenModule, resolveSessionModules } from "./session-policy";

const user = (overrides: Partial<UserEntity> = {}) =>
  new UserEntity({
    id: "u1",
    nombre: "Ana",
    apellido: "Pérez",
    correo: "ana@example.test",
    telefono: "",
    password: "hash",
    rol: "ADMIN_ROLE",
    permissionProfileId: "p1",
    estado: true,
    ...overrides,
  });

const profile = (overrides: Partial<PermissionProfileEntity> = {}) =>
  new PermissionProfileEntity({ id: "p1", nombre: "Taquilla", modules: ["events", "tickets"], estado: true, ...overrides });

describe("resolveSessionModules", () => {
  it("gives a super admin every module, with or without profile", () => {
    expect(resolveSessionModules(user({ rol: "SUPER_ROLE", permissionProfileId: undefined }), null)).toEqual([
      ...USER_MODULES,
    ]);
  });

  it("gives an admin the modules of its active profile", () => {
    expect(resolveSessionModules(user(), profile())).toEqual(["events", "tickets"]);
  });

  it("rejects inactive users, admins without profile and inactive profiles", () => {
    expect(() => resolveSessionModules(user({ estado: false }), profile())).toThrow("Usuario inactivo");
    expect(() => resolveSessionModules(user({ permissionProfileId: undefined }), null)).toThrow("perfil");
    expect(() => resolveSessionModules(user(), profile({ estado: false }))).toThrow("inactivo");
    expect(() => resolveSessionModules(user(), null)).toThrow("no existe");
  });
});

describe("canOpenModule", () => {
  it("lets super admins open everything and admins only their modules", () => {
    expect(canOpenModule({ rol: "SUPER_ROLE", modules: [] }, "users")).toBe(true);
    expect(canOpenModule({ rol: "ADMIN_ROLE", modules: ["events"] }, "events")).toBe(true);
    expect(canOpenModule({ rol: "ADMIN_ROLE", modules: ["events"] }, "users")).toBe(false);
  });
});
