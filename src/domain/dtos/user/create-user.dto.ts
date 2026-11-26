import { AUTH_ROLES, isUserRole, type UserRole } from "../../constants";
import { isValidEmail } from "../../policies/shared/email-format";
import { isValidPassword, PASSWORD_POLICY_MESSAGE } from "../../policies/user/password-policy";
import { roleNeedsProfile } from "../../policies/user/user-management-policy";
import { readProfileId, readProjectIds, text, unknownFields, USER_FIELDS } from "./user-fields";

export class CreateUserDto {
  private constructor(
    public readonly nombre: string,
    public readonly apellido: string,
    public readonly correo: string,
    public readonly telefono: string,
    public readonly password: string,
    public readonly rol: UserRole,
    public readonly permissionProfileId: string | undefined,
    public readonly proyectoIds: string[],
    public readonly estado: boolean,
  ) {}

  static create(body: Record<string, unknown>): [string?, CreateUserDto?] {
    const extra = unknownFields(body, USER_FIELDS);
    if (extra.length > 0) return [`Campos no permitidos: ${extra.join(", ")}`];

    const nombre = text(body.nombre);
    const apellido = text(body.apellido);
    const correo = text(body.correo).toLowerCase();
    const rol = body.rol === undefined ? AUTH_ROLES.ADMIN : body.rol;

    if (!nombre) return ["'nombre' es requerido"];
    if (!apellido) return ["'apellido' es requerido"];
    if (!isValidEmail(correo)) return ["'correo' no es válido"];
    if (!isValidPassword(body.password)) return [PASSWORD_POLICY_MESSAGE];
    if (!isUserRole(rol)) return ["'rol' no es válido"];

    const [profileError, permissionProfileId] = readProfileId(body.permissionProfileId);
    if (profileError) return [profileError];
    if (roleNeedsProfile(rol) && !permissionProfileId) {
      return ["Un administrador necesita un perfil de permisos ('permissionProfileId')"];
    }
    if (body.estado !== undefined && typeof body.estado !== "boolean") return ["'estado' debe ser boolean"];
    const [projectsError, proyectoIds] = readProjectIds(body.proyectoIds);
    if (projectsError) return [projectsError];

    return [
      undefined,
      new CreateUserDto(
        nombre,
        apellido,
        correo,
        text(body.telefono),
        body.password as string,
        rol,
        permissionProfileId ?? undefined,
        proyectoIds ?? [],
        body.estado !== false,
      ),
    ];
  }
}
