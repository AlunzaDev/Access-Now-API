import type { Request, Response } from "express";
import { ErrorService } from "../../../api/middlewares/errors/error-handler";
import type { EventService } from "../../../application/services/event/event.service";
import { CreateEventDto, UpdateEventDto } from "../../../domain/dtos/event/event.dto";
import { parseActiveStatus, parsePagination, parseSearch } from "../../../domain/dtos/shared/pagination";
import { bodyOf, queryOf, routeParam } from "../shared/route-params";

export class EventController {
  constructor(private readonly service: EventService) {}

  create = async (req: Request, res: Response) => {
    try {
      const [error, dto] = CreateEventDto.create(bodyOf(req));
      if (error) return ErrorService.send(res, 400, error);
      return res.status(201).json(await this.service.create(routeParam(req, "proyectoId"), dto!));
    } catch (error) { return ErrorService.handleApiError(error, res); }
  };

  list = async (req: Request, res: Response) => {
    try {
      const query = queryOf(req);
      return res.json(await this.service.list(
        {
          projectId: routeParam(req, "proyectoId"),
          buscar: parseSearch(query.buscar),
          estado: parseActiveStatus(query.estado),
        },
        parsePagination(query),
      ));
    } catch (error) { return ErrorService.handleApiError(error, res); }
  };

  getById = async (req: Request, res: Response) => {
    try { return res.json(await this.service.getById(routeParam(req, "proyectoId"), routeParam(req, "id"))); }
    catch (error) { return ErrorService.handleApiError(error, res); }
  };

  update = async (req: Request, res: Response) => {
    try {
      const [error, dto] = UpdateEventDto.create(bodyOf(req));
      if (error) return ErrorService.send(res, 400, error);
      return res.json(await this.service.update(routeParam(req, "proyectoId"), routeParam(req, "id"), dto!));
    } catch (error) { return ErrorService.handleApiError(error, res); }
  };

  delete = async (req: Request, res: Response) => {
    try { return res.json(await this.service.delete(routeParam(req, "proyectoId"), routeParam(req, "id"))); }
    catch (error) { return ErrorService.handleApiError(error, res); }
  };

  uploadImage = async (req: Request, res: Response) => {
    try {
      if (!req.file) return ErrorService.send(res, 400, "El campo 'imagen' es requerido");
      return res.json(await this.service.uploadImage(routeParam(req, "proyectoId"), routeParam(req, "id"), {
        buffer: req.file.buffer,
        contentType: req.file.mimetype,
      }));
    } catch (error) { return ErrorService.handleApiError(error, res); }
  };

  deleteImage = async (req: Request, res: Response) => {
    try { return res.json(await this.service.deleteImage(routeParam(req, "proyectoId"), routeParam(req, "id"))); }
    catch (error) { return ErrorService.handleApiError(error, res); }
  };
}
