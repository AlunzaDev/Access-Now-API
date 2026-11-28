import type { AuditFields } from "../shared/audit.entity";

export type VenueDoor = AuditFields & {
  id: string;
  projectId: string;
  nombre: string;
  descripcion: string;
  estado: boolean;
  zonaIds: string[];
};

export type VenueSeat = AuditFields & { id: string; nombre: string; estado: boolean };
export type VenueRow = AuditFields & { id: string; nombre: string; estado: boolean; asientos: VenueSeat[] };
export type VenueSection = AuditFields & {
  id: string;
  nombre: string;
  descripcion: string;
  estado: boolean;
  filas: VenueRow[];
};
export type VenueZone = AuditFields & {
  id: string;
  projectId: string;
  nombre: string;
  descripcion: string;
  estado: boolean;
  secciones: VenueSection[];
};
export type VenueLayout = { zonas: VenueZone[]; puertas: VenueDoor[] };
