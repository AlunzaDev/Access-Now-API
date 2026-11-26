import type { UserModuleAccess } from "../../constants";
import { unknownFields } from "../user/user-fields";
import { PROFILE_FIELDS, readModules } from "./profile-fields";

export type PermissionProfileChangesInput = {
  nombre?: string;
  descripcion?: string;
  modules?: UserModuleAccess[];
  estado?: boolean;
};

export class UpdatePermissionProfileDto {
  private constructor(public readonly values: PermissionProfileChangesInput) {}

  static create(body: Record<string, unknown>): [string?, UpdatePermissionProfileDto?] {
    const extra = unknownFields(body, PROFILE_FIELDS);
    if (extra.length > 0) return [`Campos no permitidos: ${extra.join(", ")}`];

    const values: PermissionProfileChangesInput = {};

    if (body.nombre !== undefined) {
      const nombre = typeof body.nombre === "string" ? body.nombre.trim() : "";
      if (!nombre) return ["'nombre' no puede estar vacío"];
      values.nombre = nombre;
    }
    if (body.descripcion !== undefined) {
      values.descripcion = typeof body.descripcion === "string" ? body.descripcion.trim() : "";
    }
    if (body.modules !== undefined) {
      const [modulesError, modules] = readModules(body.modules);
      if (modulesError) return [modulesError];
      values.modules = modules;
    }
    if (body.estado !== undefined) {
      if (typeof body.estado !== "boolean") return ["'estado' debe ser boolean"];
      values.estado = body.estado;
    }

    if (Object.keys(values).length === 0) return ["No hay campos para actualizar"];
    return [undefined, new UpdatePermissionProfileDto(values)];
  }
}
