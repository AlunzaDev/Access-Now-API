import { getInvalidUserModules, normalizeUserModules, type UserModuleAccess } from "../../constants";
import { CustomError } from "../../errors/custom.error";

export interface PermissionProfileEntityOptions {
  id: string;
  nombre: string;
  descripcion?: string;
  modules: UserModuleAccess[];
  estado: boolean;
}

/** Which dashboard sections an ADMIN_ROLE user can open. Global: the same in every project. */
export class PermissionProfileEntity {
  public id: string;
  public nombre: string;
  public descripcion?: string;
  public modules: UserModuleAccess[];
  public estado: boolean;

  constructor(options: PermissionProfileEntityOptions) {
    this.id = options.id;
    this.nombre = options.nombre;
    this.descripcion = options.descripcion;
    this.modules = options.modules;
    this.estado = options.estado;
  }

  static fromObject(object: Record<string, unknown>): PermissionProfileEntity {
    if (!object.id) throw CustomError.badRequest("Missing permission profile id");

    const nombre = typeof object.nombre === "string" ? object.nombre.trim() : "";
    if (!nombre) throw CustomError.badRequest("Missing permission profile nombre");

    if (!Array.isArray(object.modules)) throw CustomError.badRequest("Invalid permission profile modules");
    const invalidModules = getInvalidUserModules(object.modules);
    if (invalidModules.length > 0) {
      throw CustomError.badRequest(`Permission profile contains invalid modules: ${invalidModules.join(", ")}`);
    }

    return new PermissionProfileEntity({
      id: String(object.id),
      nombre,
      descripcion:
        typeof object.descripcion === "string" && object.descripcion.trim() ? object.descripcion.trim() : undefined,
      modules: normalizeUserModules(object.modules),
      estado: object.estado === undefined ? true : Boolean(object.estado),
    });
  }
}
