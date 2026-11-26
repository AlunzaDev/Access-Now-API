import { isUsuarioRol, type UsuarioRol } from "../../constants";
import { CustomError } from "../../errors/custom.error";

export interface UsuarioEntityOptions {
  id: string;
  nombre: string;
  apellido: string;
  correo: string;
  telefono: string;
  password: string;
  rol: UsuarioRol;
  permissionProfileId?: string;
  img?: string;
  estado: boolean;
}

export class UsuarioEntity {
  public id: string;
  public nombre: string;
  public apellido: string;
  public correo: string;
  public telefono: string;
  public password: string;
  public rol: UsuarioRol;
  public permissionProfileId?: string;
  public img?: string;
  public estado: boolean;

  constructor(options: UsuarioEntityOptions) {
    this.id = options.id;
    this.nombre = options.nombre;
    this.apellido = options.apellido;
    this.correo = options.correo;
    this.telefono = options.telefono;
    this.password = options.password;
    this.rol = options.rol;
    this.permissionProfileId = options.permissionProfileId;
    this.img = options.img;
    this.estado = options.estado;
  }

  static fromObject(object: Record<string, unknown>): UsuarioEntity {
    const { id, nombre, apellido, correo, telefono, password, rol, permissionProfileId, img, estado } = object;

    if (!id) throw CustomError.badRequest("Missing id");
    if (!nombre) throw CustomError.badRequest("Missing nombre");
    if (!apellido) throw CustomError.badRequest("Missing apellido");
    if (!correo) throw CustomError.badRequest("Missing correo");
    if (!password) throw CustomError.badRequest("Missing password");
    if (estado === undefined || estado === null) throw CustomError.badRequest("Missing estado");
    if (!isUsuarioRol(rol)) throw CustomError.badRequest("Invalid rol");

    return new UsuarioEntity({
      id: String(id),
      nombre: String(nombre).trim(),
      apellido: String(apellido).trim(),
      correo: String(correo).trim().toLowerCase(),
      telefono: String(telefono ?? "").trim(),
      password: String(password),
      rol,
      permissionProfileId:
        typeof permissionProfileId === "string" && permissionProfileId.trim()
          ? permissionProfileId.trim()
          : undefined,
      img: typeof img === "string" && img ? img : undefined,
      estado: Boolean(estado),
    });
  }
}
