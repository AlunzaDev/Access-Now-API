import { describe, expect, it } from "vitest";
import type { ProjectSummary } from "../../entities/project/project.entity";
import {
  canAccessProject,
  canSeeUser,
  mergeProjectAssignment,
  projectAccessOf,
  sessionProjects,
} from "./project-access-policy";

const project = (id: string, estado = true): ProjectSummary => ({ id, nombre: id, clave: id.toUpperCase(), estado });
const adminAccess = { all: false, allowed: ["a", "b"] };
const superAccess = { all: true, allowed: [] };

describe("sessionProjects", () => {
  it("gives a super admin every project and an admin its active ones", () => {
    expect(sessionProjects("SUPER_ROLE", [], [project("a"), project("z", false)]).map((p) => p.id)).toEqual(["a", "z"]);
    expect(sessionProjects("ADMIN_ROLE", [project("a"), project("b", false)]).map((p) => p.id)).toEqual(["a"]);
  });
});

describe("projectAccessOf / canAccessProject", () => {
  it("lets a super admin into any project and an admin only into its own", () => {
    expect(canAccessProject(projectAccessOf({ rol: "SUPER_ROLE", proyectos: [] }), "x")).toBe(true);
    const access = projectAccessOf({ rol: "ADMIN_ROLE", proyectos: [project("a")] });
    expect(canAccessProject(access, "a")).toBe(true);
    expect(canAccessProject(access, "x")).toBe(false);
    expect(canAccessProject(access, "")).toBe(false);
  });
});

describe("canSeeUser", () => {
  it("shows an admin only the users that share a project", () => {
    expect(canSeeUser(adminAccess, { proyectoIds: ["b", "c"] })).toBe(true);
    expect(canSeeUser(adminAccess, { proyectoIds: ["c"] })).toBe(false);
    expect(canSeeUser(adminAccess, { proyectoIds: [] })).toBe(false);
    expect(canSeeUser(superAccess, { proyectoIds: [] })).toBe(true);
  });
});

describe("mergeProjectAssignment", () => {
  it("keeps the projects the admin cannot see", () => {
    expect(mergeProjectAssignment(adminAccess, ["a", "c"], ["b"])).toEqual(["c", "b"]);
    expect(mergeProjectAssignment(adminAccess, ["a", "c"], [])).toEqual(["c"]);
  });

  it("rejects projects outside the admin's access", () => {
    expect(() => mergeProjectAssignment(adminAccess, [], ["c"])).toThrow("No puedes asignar");
  });

  it("lets a super admin set any list", () => {
    expect(mergeProjectAssignment(superAccess, ["a"], ["x", "x"])).toEqual(["x"]);
  });
});
