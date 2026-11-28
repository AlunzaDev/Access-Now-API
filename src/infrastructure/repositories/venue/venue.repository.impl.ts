import type { VenueDatasource } from "../../../domain/datasources/venue/venue.datasource";
import type { VenueRepository } from "../../../domain/repository/venue/venue.repository";

export class VenueRepositoryImpl implements VenueRepository {
  constructor(private readonly datasource: VenueDatasource) {}

  getLayout: VenueRepository["getLayout"] = (...args) => this.datasource.getLayout(...args);
  findDoor: VenueRepository["findDoor"] = (...args) => this.datasource.findDoor(...args);
  createDoor: VenueRepository["createDoor"] = (...args) => this.datasource.createDoor(...args);
  updateDoor: VenueRepository["updateDoor"] = (...args) => this.datasource.updateDoor(...args);
  deleteDoor: VenueRepository["deleteDoor"] = (...args) => this.datasource.deleteDoor(...args);
  createZone: VenueRepository["createZone"] = (...args) => this.datasource.createZone(...args);
  updateZone: VenueRepository["updateZone"] = (...args) => this.datasource.updateZone(...args);
  deleteZone: VenueRepository["deleteZone"] = (...args) => this.datasource.deleteZone(...args);
  createSection: VenueRepository["createSection"] = (...args) => this.datasource.createSection(...args);
  updateSection: VenueRepository["updateSection"] = (...args) => this.datasource.updateSection(...args);
  deleteSection: VenueRepository["deleteSection"] = (...args) => this.datasource.deleteSection(...args);
  createRow: VenueRepository["createRow"] = (...args) => this.datasource.createRow(...args);
  updateRow: VenueRepository["updateRow"] = (...args) => this.datasource.updateRow(...args);
  deleteRow: VenueRepository["deleteRow"] = (...args) => this.datasource.deleteRow(...args);
  createSeat: VenueRepository["createSeat"] = (...args) => this.datasource.createSeat(...args);
  updateSeat: VenueRepository["updateSeat"] = (...args) => this.datasource.updateSeat(...args);
  deleteSeat: VenueRepository["deleteSeat"] = (...args) => this.datasource.deleteSeat(...args);
}
