import type { Request, Response } from "express";
import { sessionActor } from "../../../api/middlewares/auth/auth.middleware";
import { ErrorService } from "../../../api/middlewares/errors/error-handler";
import type { ProjectService } from "../../../application/services/project/project.service";
import { CreateProjectDto, parseActiveStatus, parsePagination, parseSearch, UpdateProjectDto } from "../../../domain/dtos";
import { bodyOf, queryOf, routeParam } from "../shared/route-params";

export class ProjectController {
  constructor(private readonly service: ProjectService) {}

  create = async (req: Request, res: Response) => {
    try {
      const [error, dto] = CreateProjectDto.create(bodyOf(req));
      if (error) return ErrorService.send(res, 400, error);
      return res.status(201).json(await this.service.create(dto!));
    } catch (error) {
      return ErrorService.handleApiError(error, res);
    }
  };

  list = async (req: Request, res: Response) => {
    try {
      const query = queryOf(req);
      const access = sessionActor(req).projectAccess;
      return res.json(await this.service.list(access, {
        buscar: parseSearch(query.buscar),
        estado: parseActiveStatus(query.estado),
      }, parsePagination(query, 50)));
    } catch (error) {
      return ErrorService.handleApiError(error, res);
    }
  };

  getById = async (req: Request, res: Response) => {
    try {
      return res.json(await this.service.getById(sessionActor(req).projectAccess, routeParam(req, "proyectoId")));
    } catch (error) {
      return ErrorService.handleApiError(error, res);
    }
  };

  update = async (req: Request, res: Response) => {
    try {
      const [error, dto] = UpdateProjectDto.create(bodyOf(req));
      if (error) return ErrorService.send(res, 400, error);
      const access = sessionActor(req).projectAccess;
      return res.json(await this.service.update(access, routeParam(req, "proyectoId"), dto!));
    } catch (error) {
      return ErrorService.handleApiError(error, res);
    }
  };

  delete = async (req: Request, res: Response) => {
    try {
      return res.json(await this.service.delete(routeParam(req, "proyectoId")));
    } catch (error) {
      return ErrorService.handleApiError(error, res);
    }
  };

  uploadImage = async (req: Request, res: Response) => {
    try {
      if (!req.file) return ErrorService.send(res, 400, "El campo 'imagen' es requerido");
      return res.json(await this.service.uploadImage(sessionActor(req).projectAccess, routeParam(req, "proyectoId"), {
        buffer: req.file.buffer,
        contentType: req.file.mimetype,
      }));
    } catch (error) {
      return ErrorService.handleApiError(error, res);
    }
  };

  deleteImage = async (req: Request, res: Response) => {
    try {
      return res.json(await this.service.deleteImage(sessionActor(req).projectAccess, routeParam(req, "proyectoId")));
    } catch (error) {
      return ErrorService.handleApiError(error, res);
    }
  };
}
