import type { Request, Response } from "express";
import { ErrorService } from "../../../api/middlewares/errors/error-handler";
import type { TicketDocumentService } from "../../../application/services/ticket/ticket-document.service";
import { bodyOf, routeParam } from "../shared/route-params";

const sendPdf = (response: Response, { pdf, fileName }: { pdf: Buffer; fileName: string }) => {
  response.setHeader("Content-Type", "application/pdf");
  // inline: the browser (and the dashboard preview) shows it; the download keeps this name.
  response.setHeader("Content-Disposition", `inline; filename="${fileName}"`);
  response.setHeader("Cache-Control", "no-store");
  return response.send(pdf);
};

/** PDF of tickets and their delivery by email. */
export class TicketDocumentController {
  constructor(private readonly service: TicketDocumentService) {}

  /** GET /proyectos/:proyectoId/boletos/:id/pdf */
  pdf = async (request: Request, response: Response) => {
    try {
      return sendPdf(response, await this.service.pdf(routeParam(request, "proyectoId"), [routeParam(request, "id")]));
    } catch (error) {
      return ErrorService.handleApiError(error, response);
    }
  };

  /** POST /proyectos/:proyectoId/boletos/pdf { ids } */
  pdfMany = async (request: Request, response: Response) => {
    try {
      const body = bodyOf(request);
      const extra = Object.keys(body).filter((key) => key !== "ids");
      if (extra.length > 0) return ErrorService.send(response, 400, `Campos no permitidos: ${extra.join(", ")}`);
      if (!Array.isArray(body.ids) || !body.ids.every((id) => typeof id === "string")) {
        return ErrorService.send(response, 400, "'ids' debe ser un arreglo de ids de boletos");
      }
      return sendPdf(response, await this.service.pdf(routeParam(request, "proyectoId"), body.ids as string[]));
    } catch (error) {
      return ErrorService.handleApiError(error, response);
    }
  };

  /** POST /proyectos/:proyectoId/boletos/:id/enviar { correo? } */
  send = async (request: Request, response: Response) => {
    try {
      const body = bodyOf(request);
      const extra = Object.keys(body).filter((key) => key !== "correo");
      if (extra.length > 0) return ErrorService.send(response, 400, `Campos no permitidos: ${extra.join(", ")}`);
      if (body.correo !== undefined && typeof body.correo !== "string") {
        return ErrorService.send(response, 400, "'correo' debe ser texto");
      }
      return response.json(
        await this.service.send(routeParam(request, "proyectoId"), routeParam(request, "id"), body.correo as string | undefined),
      );
    } catch (error) {
      return ErrorService.handleApiError(error, response);
    }
  };

  /** GET /proyectos/:proyectoId/boletos/:id/envios */
  history = async (request: Request, response: Response) => {
    try {
      const items = await this.service.history(routeParam(request, "proyectoId"), routeParam(request, "id"));
      return response.json({ items, total: items.length });
    } catch (error) {
      return ErrorService.handleApiError(error, response);
    }
  };
}
