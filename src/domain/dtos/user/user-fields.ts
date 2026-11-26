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
  "estado",
]);

export const unknownFields = (body: Record<string, unknown>, allowed: Set<string>): string[] =>
  Object.keys(body).filter((key) => !allowed.has(key));
