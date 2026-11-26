import { getInvalidUserModules, normalizeUserModules, type UserModuleAccess } from "../../constants";

export const PROFILE_FIELDS = new Set(["nombre", "descripcion", "modules", "estado"]);

export const readModules = (value: unknown): [string?, UserModuleAccess[]?] => {
  if (!Array.isArray(value)) return ["'modules' debe ser un arreglo"];
  const invalid = getInvalidUserModules(value);
  if (invalid.length > 0) return [`Módulos no válidos: ${invalid.join(", ")}`];
  const modules = normalizeUserModules(value);
  if (modules.length === 0) return ["'modules' debe incluir al menos un módulo"];
  return [undefined, modules];
};
