import { getInvalidUserModules, normalizeUserModules, type UserModuleAccess } from "../../constants";

const readModules = (value: unknown): [string?, UserModuleAccess[]?] => {
  if (!Array.isArray(value)) return ["'modules' debe ser un arreglo"];
  const invalid = getInvalidUserModules(value);
  if (invalid.length > 0) return [`Módulos no válidos: ${invalid.join(", ")}`];
  const modules = normalizeUserModules(value);
  if (modules.length === 0) return ["'modules' debe incluir al menos un módulo"];
  return [undefined, modules];
};

export class CreatePermissionProfileDto {
  private constructor(
    public readonly nombre: string,
    public readonly modules: UserModuleAccess[],
    public readonly descripcion: string | undefined,
    public readonly estado: boolean,
  ) {}

  static create(body: Record<string, unknown>): [string?, CreatePermissionProfileDto?] {
    const nombre = typeof body.nombre === "string" ? body.nombre.trim() : "";
    if (!nombre) return ["'nombre' es requerido"];

    const [modulesError, modules] = readModules(body.modules);
    if (modulesError) return [modulesError];
    if (body.estado !== undefined && typeof body.estado !== "boolean") return ["'estado' debe ser boolean"];

    const descripcion = typeof body.descripcion === "string" && body.descripcion.trim() ? body.descripcion.trim() : undefined;
    return [undefined, new CreatePermissionProfileDto(nombre, modules!, descripcion, body.estado !== false)];
  }
}

export class UpdatePermissionProfileDto {
  private constructor(
    public readonly values: {
      nombre?: string;
      descripcion?: string;
      modules?: UserModuleAccess[];
      estado?: boolean;
    },
  ) {}

  static create(body: Record<string, unknown>): [string?, UpdatePermissionProfileDto?] {
    const values: UpdatePermissionProfileDto["values"] = {};

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
