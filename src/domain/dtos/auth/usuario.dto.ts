import { passwordPolicyPlugin } from "../../../config/plugins/password-policy.plugin";
import { regularExps } from "../../../config/plugins/regular-exps.plugin";
import { AUTH_ROLES, isUsuarioRol, type UsuarioRol } from "../../constants";
import { isUuid } from "../../helpers/uuid";

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

/** `null` clears the profile, `undefined` leaves it as it is. */
const readProfileId = (value: unknown): [string?, (string | null)?] => {
  if (value === undefined) return [undefined, undefined];
  if (value === null || value === "") return [undefined, null];
  if (typeof value !== "string" || !isUuid(value.trim())) {
    return ["'permissionProfileId' no es válido"];
  }
  return [undefined, value.trim()];
};

export class CreateUsuarioDto {
  private constructor(
    public readonly nombre: string,
    public readonly apellido: string,
    public readonly correo: string,
    public readonly telefono: string,
    public readonly password: string,
    public readonly rol: UsuarioRol,
    public readonly permissionProfileId: string | undefined,
    public readonly estado: boolean,
  ) {}

  static create(body: Record<string, unknown>): [string?, CreateUsuarioDto?] {
    const nombre = text(body.nombre);
    const apellido = text(body.apellido);
    const correo = text(body.correo).toLowerCase();
    const telefono = text(body.telefono);
    const password = typeof body.password === "string" ? body.password : "";
    const rol = body.rol === undefined ? AUTH_ROLES.ADMIN : body.rol;

    if (!nombre) return ["'nombre' es requerido"];
    if (!apellido) return ["'apellido' es requerido"];
    if (!correo || !regularExps.email.test(correo)) return ["'correo' no es válido"];
    if (!passwordPolicyPlugin.isValid(password)) return [passwordPolicyPlugin.message];
    if (!isUsuarioRol(rol)) return ["'rol' no es válido"];

    const [profileError, permissionProfileId] = readProfileId(body.permissionProfileId);
    if (profileError) return [profileError];
    if (rol === AUTH_ROLES.ADMIN && !permissionProfileId) {
      return ["Un administrador necesita un perfil de permisos ('permissionProfileId')"];
    }
    if (body.estado !== undefined && typeof body.estado !== "boolean") return ["'estado' debe ser boolean"];

    return [
      undefined,
      new CreateUsuarioDto(
        nombre,
        apellido,
        correo,
        telefono,
        password,
        rol,
        permissionProfileId ?? undefined,
        body.estado === undefined ? true : (body.estado as boolean),
      ),
    ];
  }
}

export class UpdateUsuarioDto {
  private constructor(
    public readonly values: {
      nombre?: string;
      apellido?: string;
      correo?: string;
      telefono?: string;
      password?: string;
      rol?: UsuarioRol;
      permissionProfileId?: string | null;
      estado?: boolean;
    },
  ) {}

  static create(body: Record<string, unknown>): [string?, UpdateUsuarioDto?] {
    const values: UpdateUsuarioDto["values"] = {};

    for (const field of ["nombre", "apellido", "telefono"] as const) {
      if (body[field] === undefined) continue;
      const value = text(body[field]);
      if (!value && field !== "telefono") return [`'${field}' no puede estar vacío`];
      values[field] = value;
    }
    if (body.correo !== undefined) {
      const correo = text(body.correo).toLowerCase();
      if (!regularExps.email.test(correo)) return ["'correo' no es válido"];
      values.correo = correo;
    }
    if (body.password !== undefined && body.password !== "") {
      if (typeof body.password !== "string" || !passwordPolicyPlugin.isValid(body.password)) {
        return [passwordPolicyPlugin.message];
      }
      values.password = body.password;
    }
    if (body.rol !== undefined) {
      if (!isUsuarioRol(body.rol)) return ["'rol' no es válido"];
      values.rol = body.rol;
    }
    const [profileError, permissionProfileId] = readProfileId(body.permissionProfileId);
    if (profileError) return [profileError];
    if (permissionProfileId !== undefined) values.permissionProfileId = permissionProfileId;
    if (body.estado !== undefined) {
      if (typeof body.estado !== "boolean") return ["'estado' debe ser boolean"];
      values.estado = body.estado;
    }

    if (Object.keys(values).length === 0) return ["No hay campos para actualizar"];
    return [undefined, new UpdateUsuarioDto(values)];
  }
}
