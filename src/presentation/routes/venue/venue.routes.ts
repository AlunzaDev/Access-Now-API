import { Router } from "express";
import type { AuthMiddleware } from "../../../api/middlewares";
import { buildVenueController } from "../../dependencies";

export class VenueRoutes {
  static routes(auth: AuthMiddleware): Router {
    const router = Router({ mergeParams: true });
    const controller = buildVenueController();
    router.use(auth.requireAuth, auth.requireProjectAccess());
    router.get("/", auth.requireModules("projects", "scanners", "events", "tickets"), controller.getLayout);
    router.post("/puertas", auth.requireModules("projects"), controller.createDoor);
    router.patch("/puertas/:id", auth.requireModules("projects"), controller.updateDoor);
    router.delete("/puertas/:id", auth.requireModules("projects"), controller.deleteDoor);
    router.post("/zonas", auth.requireModules("projects"), controller.createCatalog("zone"));
    router.patch("/zonas/:id", auth.requireModules("projects"), controller.updateCatalog("zone"));
    router.delete("/zonas/:id", auth.requireModules("projects"), controller.deleteCatalog("zone"));
    router.post(
      "/zonas/:zonaId/secciones",
      auth.requireModules("projects"),
      controller.createCatalog("section", "zonaId"),
    );
    router.patch("/secciones/:id", auth.requireModules("projects"), controller.updateCatalog("section"));
    router.delete("/secciones/:id", auth.requireModules("projects"), controller.deleteCatalog("section"));
    router.post(
      "/secciones/:seccionId/filas",
      auth.requireModules("projects"),
      controller.createCatalog("row", "seccionId"),
    );
    router.patch("/filas/:id", auth.requireModules("projects"), controller.updateCatalog("row"));
    router.delete("/filas/:id", auth.requireModules("projects"), controller.deleteCatalog("row"));
    router.post(
      "/filas/:filaId/asientos",
      auth.requireModules("projects"),
      controller.createCatalog("seat", "filaId"),
    );
    router.patch("/asientos/:id", auth.requireModules("projects"), controller.updateCatalog("seat"));
    router.delete("/asientos/:id", auth.requireModules("projects"), controller.deleteCatalog("seat"));
    return router;
  }
}
