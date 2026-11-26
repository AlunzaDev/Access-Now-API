import { isUserRole, type UserRole } from "../../constants";
import { isValidEmail } from "../../policies/shared/email-format";
import { isValidPassword, PASSWORD_POLICY_MESSAGE } from "../../policies/user/password-policy";
import { readProfileId, readProjectIds, text, unknownFields, USER_FIELDS } from "./user-fields";

export type UserChangesInput = {
  nombre?: string;
  apellido?: string;
  correo?: string;
  telefono?: string;
  password?: string;
  rol?: UserRole;
  permissionProfileId?: string | null;
  proyectoIds?: string[];
  estado?: boolean;
};

export class UpdateUserDto {
  private constructor(public readonly values: UserChangesInput) {}

  static create(body: Record<string, unknown>): [string?, UpdateUserDto?] {
    const extra = unknownFields(body, USER_FIELDS);
    if (extra.length > 0) return [`Campos no permitidos: ${extra.join(", ")}`];

    const values: UserChangesInput = {};

    for (const field of ["nombre", "apellido", "telefono"] as const) {
      if (body[field] === undefined) continue;
      const value = text(body[field]);
      if (!value && field !== "telefono") return [`'${field}' no puede estar vacío`];
      values[field] = value;
    }
    if (body.correo !== undefined) {
      const correo = text(body.correo).toLowerCase();
      if (!isValidEmail(correo)) return ["'correo' no es válido"];
      values.correo = correo;
    }
    if (body.password !== undefined && body.password !== "") {
      if (!isValidPassword(body.password)) return [PASSWORD_POLICY_MESSAGE];
      values.password = body.password;
    }
    if (body.rol !== undefined) {
      if (!isUserRole(body.rol)) return ["'rol' no es válido"];
      values.rol = body.rol;
    }
    const [profileError, permissionProfileId] = readProfileId(body.permissionProfileId);
    if (profileError) return [profileError];
    if (permissionProfileId !== undefined) values.permissionProfileId = permissionProfileId;
    if (body.estado !== undefined) {
      if (typeof body.estado !== "boolean") return ["'estado' debe ser boolean"];
      values.estado = body.estado;
    }
    const [projectsError, proyectoIds] = readProjectIds(body.proyectoIds);
    if (projectsError) return [projectsError];
    if (proyectoIds !== undefined) values.proyectoIds = proyectoIds;

    if (Object.keys(values).length === 0) return ["No hay campos para actualizar"];
    return [undefined, new UpdateUserDto(values)];
  }
}
