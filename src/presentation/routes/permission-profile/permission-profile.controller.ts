import type { Request, Response } from "express";
import { ErrorService } from "../../../api/middlewares/errors/error-handler";
import type { PermissionProfileService } from "../../../application/services/permission-profile/permission-profile.service";
import { USER_MODULES } from "../../../domain/constants";
import {
  CreatePermissionProfileDto,
  parseActiveStatus,
  parsePagination,
  parseSearch,
  UpdatePermissionProfileDto,
} from "../../../domain/dtos";
import { bodyOf, queryOf, routeParam } from "../shared/route-params";

export class PermissionProfileController {
  constructor(private readonly service: PermissionProfileService) {}

  /** The sections a profile can include, for the dashboard form. */
  modules = (_req: Request, res: Response) => res.json({ items: USER_MODULES, total: USER_MODULES.length });

  create = async (req: Request, res: Response) => {
    try {
      const [error, dto] = CreatePermissionProfileDto.create(bodyOf(req));
      if (error) return ErrorService.send(res, 400, error);
      return res.status(201).json(await this.service.create(dto!));
    } catch (error) {
      return ErrorService.handleApiError(error, res);
    }
  };

  list = async (req: Request, res: Response) => {
    try {
      const query = queryOf(req);
      return res.json(await this.service.list({
        buscar: parseSearch(query.buscar),
        estado: parseActiveStatus(query.estado),
      }, parsePagination(query, 50)));
    } catch (error) {
      return ErrorService.handleApiError(error, res);
    }
  };

  getById = async (req: Request, res: Response) => {
    try {
      return res.json(await this.service.getById(routeParam(req, "id")));
    } catch (error) {
      return ErrorService.handleApiError(error, res);
    }
  };

  update = async (req: Request, res: Response) => {
    try {
      const [error, dto] = UpdatePermissionProfileDto.create(bodyOf(req));
      if (error) return ErrorService.send(res, 400, error);
      return res.json(await this.service.update(routeParam(req, "id"), dto!));
    } catch (error) {
      return ErrorService.handleApiError(error, res);
    }
  };

  delete = async (req: Request, res: Response) => {
    try {
      return res.json(await this.service.delete(routeParam(req, "id")));
    } catch (error) {
      return ErrorService.handleApiError(error, res);
    }
  };
}
