import type { Request, Response } from "express";
import { ErrorService } from "../../../api/middlewares/errors/error-handler";
import { requestGateway } from "../../../api/middlewares/gateway/gateway-auth.middleware";
import type { TicketCatalogService } from "../../../application/services/ticket/ticket-catalog.service";
import { OfflineScansDto } from "../../../domain/dtos/ticket/offline-scans.dto";
import { bodyOf, queryOf } from "../shared/route-params";

/** The gateway side of tickets without internet (token operativo + huella). */
export class TicketCatalogController {
  constructor(private readonly service: TicketCatalogService) {}

  /** GET /api/v1/tickets/catalogo?cursor= */
  catalog = async (request: Request, response: Response) => {
    try {
      const { project } = requestGateway(request);
      return response.json(await this.service.catalog(project.id, queryOf(request).cursor));
    } catch (error) {
      return ErrorService.handleApiError(error, response);
    }
  };

  /** POST /api/v1/tickets/escaneos-offline */
  offlineScans = async (request: Request, response: Response) => {
    try {
      const [error, dto] = OfflineScansDto.create(bodyOf(request));
      if (error) return ErrorService.send(response, 400, error);
      const { project, device } = requestGateway(request);
      return response.json(await this.service.offlineScans(project.id, device.id, dto!));
    } catch (error) {
      return ErrorService.handleApiError(error, response);
    }
  };
}
