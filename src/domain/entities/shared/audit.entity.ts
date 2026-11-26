export type AuditActor = {
  id: string | null;
  nombre: string;
};

export type AuditFields = {
  creadoPor: AuditActor;
  creadoEn: number;
  actualizadoPor: AuditActor;
  actualizadoEn: number;
};

export const systemAuditFields = (): AuditFields => ({
  creadoPor: { id: null, nombre: "Sistema" },
  creadoEn: Date.now(),
  actualizadoPor: { id: null, nombre: "Sistema" },
  actualizadoEn: Date.now(),
});

const instant = (value: unknown): number =>
  value instanceof Date ? value.getTime() : typeof value === "number" ? value : new Date(String(value)).getTime();

export const auditFieldsFromObject = (object: Record<string, unknown>): AuditFields => ({
  creadoPor: {
    id: typeof object.creadoPorId === "string" ? object.creadoPorId : null,
    nombre: String(object.creadoPorNombre ?? "Sistema"),
  },
  creadoEn: instant(object.createdAt),
  actualizadoPor: {
    id: typeof object.actualizadoPorId === "string" ? object.actualizadoPorId : null,
    nombre: String(object.actualizadoPorNombre ?? "Sistema"),
  },
  actualizadoEn: instant(object.updatedAt),
});

export type AuditWrite = {
  actorId: string;
  actorNombre: string;
};
