import { Router } from "express";
import type { AuthMiddleware } from "../../../api/middlewares";
import { buildTicketController, buildTicketDocumentController } from "../../dependencies";

export class TicketRoutes {
  static routes(auth: AuthMiddleware): Router {
    const router = Router({ mergeParams: true });
    const controller = buildTicketController();
    const documents = buildTicketDocumentController();
    router.use(auth.requireAuth, auth.requireModules("tickets"), auth.requireProjectAccess());
    router.get("/", controller.list);
    router.post("/", controller.create);
    router.post("/lote", controller.createBatch);
    router.post("/pdf", documents.pdfMany);
    router.get("/:id", controller.getById);
    router.patch("/:id", controller.update);
    router.get("/:id/qr", controller.getQr);
    router.get("/:id/pdf", documents.pdf);
    router.post("/:id/enviar", documents.send);
    router.get("/:id/envios", documents.history);
    router.post("/:id/reemitir-qr", controller.reissue);
    router.delete("/:id", controller.cancel);
    return router;
  }
}
