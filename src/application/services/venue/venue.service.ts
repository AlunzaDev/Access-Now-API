import type { VenueCatalogInput, VenueDoorInput } from "../../../domain/datasources/venue/venue.datasource";
import { CustomError } from "../../../domain/errors/custom.error";
import type { VenueRepository } from "../../../domain/repository/venue/venue.repository";

export class VenueService {
  constructor(private readonly venues: VenueRepository) {}

  getLayout(projectId: string) {
    return this.venues.getLayout(projectId);
  }

  async createDoor(projectId: string, input: VenueDoorInput) {
    await this.validateZoneIds(projectId, input.zonaIds);
    return this.venues.createDoor(projectId, input);
  }

  async updateDoor(projectId: string, id: string, input: Partial<VenueDoorInput>) {
    if (input.zonaIds) await this.validateZoneIds(projectId, input.zonaIds);
    const door = await this.venues.updateDoor(projectId, id, input);
    if (!door) throw CustomError.notFound("Puerta no encontrada");
    return door;
  }

  async deleteDoor(projectId: string, id: string) {
    const door = await this.venues.deleteDoor(projectId, id);
    if (!door) throw CustomError.notFound("Puerta no encontrada");
    return door;
  }

  async createCatalog(
    projectId: string,
    type: "zone" | "section" | "row" | "seat",
    parentId: string | null,
    input: VenueCatalogInput,
  ) {
    const layout = await this.venues.getLayout(projectId);
    if (type === "zone") await this.venues.createZone(projectId, input);
    if (type === "section") {
      if (!layout.zonas.some((zone) => zone.id === parentId)) throw CustomError.notFound("Zona no encontrada");
      await this.venues.createSection(parentId!, input);
    }
    if (type === "row") {
      const exists = layout.zonas.some((zone) => zone.secciones.some((section) => section.id === parentId));
      if (!exists) throw CustomError.notFound("Sección no encontrada");
      await this.venues.createRow(parentId!, input);
    }
    if (type === "seat") {
      const exists = layout.zonas.some((zone) => zone.secciones.some((section) =>
        section.filas.some((row) => row.id === parentId)));
      if (!exists) throw CustomError.notFound("Fila no encontrada");
      await this.venues.createSeat(parentId!, input);
    }
    return this.venues.getLayout(projectId);
  }

  async updateCatalog(
    projectId: string,
    type: "zone" | "section" | "row" | "seat",
    id: string,
    input: Partial<VenueCatalogInput>,
  ) {
    await this.assertCatalog(projectId, type, id);
    const updated = type === "zone"
      ? await this.venues.updateZone(projectId, id, input)
      : type === "section"
        ? await this.venues.updateSection(id, input)
        : type === "row"
          ? await this.venues.updateRow(id, input)
          : await this.venues.updateSeat(id, input);
    if (!updated) throw CustomError.notFound("Elemento del recinto no encontrado");
    return this.venues.getLayout(projectId);
  }

  async deleteCatalog(projectId: string, type: "zone" | "section" | "row" | "seat", id: string) {
    await this.assertCatalog(projectId, type, id);
    const deleted = type === "zone"
      ? await this.venues.deleteZone(projectId, id)
      : type === "section"
        ? await this.venues.deleteSection(id)
        : type === "row"
          ? await this.venues.deleteRow(id)
          : await this.venues.deleteSeat(id);
    if (!deleted) throw CustomError.notFound("Elemento del recinto no encontrado");
    return this.venues.getLayout(projectId);
  }

  private async validateZoneIds(projectId: string, zoneIds: string[]) {
    const available = new Set((await this.venues.getLayout(projectId)).zonas.map((zone) => zone.id));
    if (zoneIds.some((id) => !available.has(id))) {
      throw CustomError.badRequest("Todas las zonas deben pertenecer al proyecto");
    }
  }

  private async assertCatalog(
    projectId: string,
    type: "zone" | "section" | "row" | "seat",
    id: string,
  ) {
    const layout = await this.venues.getLayout(projectId);
    const found = layout.zonas.some((zone) =>
      (type === "zone" && zone.id === id)
      || zone.secciones.some((section) =>
        (type === "section" && section.id === id)
        || section.filas.some((row) =>
          (type === "row" && row.id === id)
          || (type === "seat" && row.asientos.some((seat) => seat.id === id)))));
    if (!found) throw CustomError.notFound("Elemento del recinto no encontrado");
  }
}
