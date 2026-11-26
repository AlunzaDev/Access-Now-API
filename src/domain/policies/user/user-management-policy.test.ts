import { describe, expect, it } from "vitest";
import { assertCanManageUser, assertSelfChangeAllowed, roleNeedsProfile } from "./user-management-policy";

const superAdmin = { id: "s1", rol: "SUPER_ROLE" as const };
const admin = { id: "a1", rol: "ADMIN_ROLE" as const };

describe("assertCanManageUser", () => {
  it("lets a super admin manage anyone", () => {
    expect(() => assertCanManageUser(superAdmin, { id: "s2", rol: "SUPER_ROLE" }, "SUPER_ROLE")).not.toThrow();
  });

  it("keeps admins away from super admins", () => {
    expect(() => assertCanManageUser(admin, null, "SUPER_ROLE")).toThrow("asignar SUPER_ROLE");
    expect(() => assertCanManageUser(admin, superAdmin)).toThrow("modificar esta cuenta");
    expect(() => assertCanManageUser(admin, { id: "a2", rol: "ADMIN_ROLE" }, "ADMIN_ROLE")).not.toThrow();
  });
});

describe("assertSelfChangeAllowed", () => {
  it("blocks deactivating, demoting or deleting your own account", () => {
    expect(() => assertSelfChangeAllowed("s1", superAdmin, { estado: false })).toThrow();
    expect(() => assertSelfChangeAllowed("s1", superAdmin, { rol: "ADMIN_ROLE" })).toThrow();
    expect(() => assertSelfChangeAllowed("s1", superAdmin, { delete: true })).toThrow("eliminar");
  });

  it("allows harmless self changes and any change to other users", () => {
    expect(() => assertSelfChangeAllowed("s1", superAdmin, { rol: "SUPER_ROLE", estado: true })).not.toThrow();
    expect(() => assertSelfChangeAllowed("s1", admin, { estado: false, delete: true })).not.toThrow();
  });
});

describe("roleNeedsProfile", () => {
  it("is true only for admins", () => {
    expect(roleNeedsProfile("ADMIN_ROLE")).toBe(true);
    expect(roleNeedsProfile("SUPER_ROLE")).toBe(false);
  });
});
