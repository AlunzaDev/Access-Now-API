import { normalizeClave } from "../../entities/project/project.entity";

export const PROJECT_FIELDS = new Set(["nombre", "clave", "descripcion", "direccion", "ciudad", "estado"]);

const TEXT_FIELDS = ["descripcion", "direccion", "ciudad"] as const;

export type ProjectValues = {
  nombre?: string;
  clave?: string;
  descripcion?: string;
  direccion?: string;
  ciudad?: string;
  estado?: boolean;
};

/** Reads a create/update body; `required` makes nombre and clave mandatory. */
export const readProject = (body: Record<string, unknown>, required: boolean): [string?, ProjectValues?] => {
  const values: ProjectValues = {};

  if (body.nombre !== undefined || required) {
    const nombre = typeof body.nombre === "string" ? body.nombre.trim() : "";
    if (!nombre) return ["'nombre' es requerido"];
    values.nombre = nombre;
  }
  if (body.clave !== undefined || required) {
    const clave = normalizeClave(body.clave);
    if (!clave) return ["'clave' es requerida (letras, números y guiones)"];
    if (clave.length > 40) return ["'clave' debe tener máximo 40 caracteres"];
    values.clave = clave;
  }
  for (const field of TEXT_FIELDS) {
    if (body[field] === undefined) continue;
    if (typeof body[field] !== "string") return [`'${field}' debe ser texto`];
    values[field] = (body[field] as string).trim();
  }
  if (body.estado !== undefined) {
    if (typeof body.estado !== "boolean") return ["'estado' debe ser boolean"];
    values.estado = body.estado;
  }
  return [undefined, values];
};
