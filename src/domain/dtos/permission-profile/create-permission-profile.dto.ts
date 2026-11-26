import type { UserModuleAccess } from "../../constants";
import { unknownFields } from "../user/user-fields";
import { PROFILE_FIELDS, readModules } from "./profile-fields";

export class CreatePermissionProfileDto {
  private constructor(
    public readonly nombre: string,
    public readonly modules: UserModuleAccess[],
    public readonly descripcion: string | undefined,
    public readonly estado: boolean,
  ) {}

  static create(body: Record<string, unknown>): [string?, CreatePermissionProfileDto?] {
    const extra = unknownFields(body, PROFILE_FIELDS);
    if (extra.length > 0) return [`Campos no permitidos: ${extra.join(", ")}`];

    const nombre = typeof body.nombre === "string" ? body.nombre.trim() : "";
    if (!nombre) return ["'nombre' es requerido"];

    const [modulesError, modules] = readModules(body.modules);
    if (modulesError) return [modulesError];
    if (body.estado !== undefined && typeof body.estado !== "boolean") return ["'estado' debe ser boolean"];

    const descripcion =
      typeof body.descripcion === "string" && body.descripcion.trim() ? body.descripcion.trim() : undefined;
    return [undefined, new CreatePermissionProfileDto(nombre, modules!, descripcion, body.estado !== false)];
  }
}
