export type ProjectLocationValidation = {
  error?: string;
  latitud?: number | null;
  longitud?: number | null;
};

/** Validates the API location pair without depending on transport or persistence. */
export const validateProjectLocation = (latitud: unknown, longitud: unknown): ProjectLocationValidation => {
  const hasLatitude = latitud !== undefined && latitud !== null;
  const hasLongitude = longitud !== undefined && longitud !== null;
  if (hasLatitude !== hasLongitude) return { error: "'latitud' y 'longitud' deben enviarse juntas" };
  if (!hasLatitude) return { latitud: latitud === null ? null : undefined, longitud: longitud === null ? null : undefined };
  if (typeof latitud !== "number" || !Number.isFinite(latitud) || latitud < -90 || latitud > 90) {
    return { error: "'latitud' debe ser un número entre -90 y 90" };
  }
  if (typeof longitud !== "number" || !Number.isFinite(longitud) || longitud < -180 || longitud > 180) {
    return { error: "'longitud' debe ser un número entre -180 y 180" };
  }
  return { latitud, longitud };
};
