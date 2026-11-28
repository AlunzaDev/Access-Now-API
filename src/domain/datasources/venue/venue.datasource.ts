import type { VenueDoor, VenueLayout } from "../../entities/venue/venue.entity";

export type VenueDoorInput = {
  nombre: string;
  descripcion: string;
  estado: boolean;
  zonaIds: string[];
};

export type VenueCatalogInput = {
  nombre: string;
  descripcion?: string;
  estado: boolean;
};

export interface VenueDatasource {
  getLayout(projectId: string): Promise<VenueLayout>;
  findDoor(projectId: string, id: string): Promise<VenueDoor | null>;
  createDoor(projectId: string, input: VenueDoorInput): Promise<VenueDoor>;
  updateDoor(projectId: string, id: string, input: Partial<VenueDoorInput>): Promise<VenueDoor | null>;
  deleteDoor(projectId: string, id: string): Promise<VenueDoor | null>;
  createZone(projectId: string, input: VenueCatalogInput): Promise<void>;
  updateZone(projectId: string, id: string, input: Partial<VenueCatalogInput>): Promise<boolean>;
  deleteZone(projectId: string, id: string): Promise<boolean>;
  createSection(zoneId: string, input: VenueCatalogInput): Promise<void>;
  updateSection(id: string, input: Partial<VenueCatalogInput>): Promise<boolean>;
  deleteSection(id: string): Promise<boolean>;
  createRow(sectionId: string, input: VenueCatalogInput): Promise<void>;
  updateRow(id: string, input: Partial<VenueCatalogInput>): Promise<boolean>;
  deleteRow(id: string): Promise<boolean>;
  createSeat(rowId: string, input: VenueCatalogInput): Promise<void>;
  updateSeat(id: string, input: Partial<VenueCatalogInput>): Promise<boolean>;
  deleteSeat(id: string): Promise<boolean>;
}
