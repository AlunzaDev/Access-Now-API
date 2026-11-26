import { isUuid } from "../../helpers/uuid";

export const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

/** `null` clears the profile, `undefined` leaves it as it is. */
export const readProfileId = (value: unknown): [string?, (string | null)?] => {
  if (value === undefined) return [undefined, undefined];
  if (value === null || value === "") return [undefined, null];
  if (typeof value !== "string" || !isUuid(value.trim())) {
    return ["'permissionProfileId' no es válido"];
  }
  return [undefined, value.trim()];
};

/** Fields a user body may carry; anything else is rejected (docs/contrato-api.md). */
export const USER_FIELDS = new Set([
  "nombre",
  "apellido",
  "correo",
  "telefono",
  "password",
  "rol",
  "permissionProfileId",
  "proyectoIds",
  "estado",
]);

/** `undefined` leaves the projects as they are; an array replaces them (see mergeProjectAssignment). */
export const readProjectIds = (value: unknown): [string?, string[]?] => {
  if (value === undefined) return [undefined, undefined];
  if (!Array.isArray(value)) return ["'proyectoIds' debe ser un arreglo"];
  const ids = Array.from(new Set(value.map((item) => (typeof item === "string" ? item.trim() : ""))));
  if (!ids.every(isUuid)) return ["'proyectoIds' contiene valores no válidos"];
  return [undefined, ids];
};

export const unknownFields = (body: Record<string, unknown>, allowed: Set<string>): string[] =>
  Object.keys(body).filter((key) => !allowed.has(key));
