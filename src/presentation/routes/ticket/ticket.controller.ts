import type { Request, Response } from "express";
import { sessionUser } from "../../../api/middlewares/auth/auth.middleware";
import { canOpenModule } from "../../../domain/policies/auth/session-policy";
import { ErrorService } from "../../../api/middlewares/errors/error-handler";
import type { TicketService } from "../../../application/services/ticket/ticket.service";
import { normalizeMac } from "../../../domain/policies/device/device-policy";
import { parsePagination, parseSearch } from "../../../domain/dtos/shared/pagination";
import {
  CreateTicketBatchDto,
  CreateTicketDto,
  UpdateTicketDto,
} from "../../../domain/dtos/ticket/ticket.dto";
import { TICKET_SALE_STATUSES, type TicketSaleStatus } from "../../../domain/policies/ticket/ticket-policy";
import { bodyOf, queryOf, routeParam } from "../shared/route-params";
import { requestGateway } from "../../../api/middlewares/gateway/gateway-auth.middleware";

export class TicketController {
  constructor(private readonly service: TicketService) {}

  create = async (request: Request, response: Response) => {
    try {
      const [error, dto] = CreateTicketDto.create(bodyOf(request));
      if (error) return ErrorService.send(response, 400, error);
      return response.status(201).json(await this.service.create(routeParam(request, "proyectoId"), dto!));
    } catch (error) { return ErrorService.handleApiError(error, response); }
  };

  createBatch = async (request: Request, response: Response) => {
    try {
      const [error, dto] = CreateTicketBatchDto.create(bodyOf(request));
      if (error) return ErrorService.send(response, 400, error);
      return response.status(201).json(await this.service.createBatch(routeParam(request, "proyectoId"), dto!));
    } catch (error) { return ErrorService.handleApiError(error, response); }
  };

  list = async (request: Request, response: Response) => {
    try {
      const query = queryOf(request);
      const saleStatus = typeof query.estadoVenta === "string" ? query.estadoVenta : undefined;
      if (saleStatus && !TICKET_SALE_STATUSES.includes(saleStatus as TicketSaleStatus)) {
        return ErrorService.send(response, 400, "'estadoVenta' no es válido");
      }
      return response.json(await this.service.list({
        projectId: routeParam(request, "proyectoId"),
        eventId: typeof query.eventoId === "string" ? query.eventoId : undefined,
        estadoVenta: saleStatus as TicketSaleStatus | undefined,
        buscar: parseSearch(query.buscar),
      }, parsePagination(query)));
    } catch (error) { return ErrorService.handleApiError(error, response); }
  };

  getById = async (request: Request, response: Response) => {
    try {
      const withHistory = canOpenModule(sessionUser(request), "history");
      return response.json(await this.service.getById(routeParam(request, "proyectoId"), routeParam(request, "id"), withHistory));
    }
    catch (error) { return ErrorService.handleApiError(error, response); }
  };

  update = async (request: Request, response: Response) => {
    try {
      const [error, dto] = UpdateTicketDto.create(bodyOf(request));
      if (error) return ErrorService.send(response, 400, error);
      return response.json(await this.service.update(
        routeParam(request, "proyectoId"), routeParam(request, "id"), dto!,
      ));
    } catch (error) { return ErrorService.handleApiError(error, response); }
  };

  cancel = async (request: Request, response: Response) => {
    try { return response.json(await this.service.cancel(routeParam(request, "proyectoId"), routeParam(request, "id"))); }
    catch (error) { return ErrorService.handleApiError(error, response); }
  };

  reissue = async (request: Request, response: Response) => {
    try { return response.json(await this.service.reissue(routeParam(request, "proyectoId"), routeParam(request, "id"))); }
    catch (error) { return ErrorService.handleApiError(error, response); }
  };

  getQr = async (request: Request, response: Response) => {
    try { return response.json(await this.service.getQr(routeParam(request, "proyectoId"), routeParam(request, "id"))); }
    catch (error) { return ErrorService.handleApiError(error, response); }
  };

  validateAccess = async (request: Request, response: Response) => {
    try {
      const body = bodyOf(request);
      const unknown = Object.keys(body).filter((key) => !["token", "terminalMac"].includes(key));
      if (unknown.length) return ErrorService.send(response, 400, `Campos no permitidos: ${unknown.join(", ")}`);
      if (typeof body.token !== "string") return ErrorService.send(response, 400, "'token' es requerido");
      let terminalMac: string | undefined;
      if (body.terminalMac !== undefined) {
        terminalMac = normalizeMac(body.terminalMac) ?? undefined;
        if (!terminalMac) return ErrorService.send(response, 400, "'terminalMac' debe tener el formato AA:BB:CC:DD:EE:FF");
      }
      const gateway = requestGateway(request);
      return response.json(await this.service.validateAccess(gateway.project.id, body.token.trim(), {
        gatewayId: gateway.device.id,
        terminalMac,
      }));
    } catch (error) { return ErrorService.handleApiError(error, response); }
  };
}
