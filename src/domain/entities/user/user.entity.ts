import { isUserRole, type UserRole } from "../../constants";
import { CustomError } from "../../errors/custom.error";

export interface UserEntityOptions {
  id: string;
  nombre: string;
  apellido: string;
  correo: string;
  telefono: string;
  /** bcrypt hash; never leaves the API (see toPublicUser). */
  password: string;
  rol: UserRole;
  permissionProfileId?: string;
  /** Projects the user works in. Empty for SUPER_ROLE, which sees them all. */
  proyectoIds: string[];
  img?: string;
  estado: boolean;
}

/** A dashboard user. Field names are the API contract, in Spanish (docs/convencion-nombres.md). */
export class UserEntity {
  public id: string;
  public nombre: string;
  public apellido: string;
  public correo: string;
  public telefono: string;
  public password: string;
  public rol: UserRole;
  public permissionProfileId?: string;
  public proyectoIds: string[];
  public img?: string;
  public estado: boolean;

  constructor(options: UserEntityOptions) {
    this.id = options.id;
    this.nombre = options.nombre;
    this.apellido = options.apellido;
    this.correo = options.correo;
    this.telefono = options.telefono;
    this.password = options.password;
    this.rol = options.rol;
    this.permissionProfileId = options.permissionProfileId;
    this.proyectoIds = options.proyectoIds;
    this.img = options.img;
    this.estado = options.estado;
  }

  static fromObject(object: Record<string, unknown>): UserEntity {
    const { id, nombre, apellido, correo, telefono, password, rol, permissionProfileId, proyectoIds, img, estado } = object;

    if (!id) throw CustomError.badRequest("Missing id");
    if (!nombre) throw CustomError.badRequest("Missing nombre");
    if (!apellido) throw CustomError.badRequest("Missing apellido");
    if (!correo) throw CustomError.badRequest("Missing correo");
    if (!password) throw CustomError.badRequest("Missing password");
    if (estado === undefined || estado === null) throw CustomError.badRequest("Missing estado");
    if (!isUserRole(rol)) throw CustomError.badRequest("Invalid rol");

    return new UserEntity({
      id: String(id),
      nombre: String(nombre).trim(),
      apellido: String(apellido).trim(),
      correo: String(correo).trim().toLowerCase(),
      telefono: String(telefono ?? "").trim(),
      password: String(password),
      rol,
      permissionProfileId:
        typeof permissionProfileId === "string" && permissionProfileId.trim() ? permissionProfileId.trim() : undefined,
      proyectoIds: Array.isArray(proyectoIds)
        ? Array.from(new Set(proyectoIds.map((value) => String(value ?? "").trim()).filter(Boolean)))
        : [],
      img: typeof img === "string" && img ? img : undefined,
      estado: Boolean(estado),
    });
  }
}

/** The user as the API returns it: everything but the password hash. */
export type PublicUser = Omit<UserEntity, "password">;

export const toPublicUser = (user: UserEntity): PublicUser => {
  const { password: _password, ...publicUser } = user;
  return publicUser;
};
