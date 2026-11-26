import type { Request, Response } from "express";
import { USER_MODULES } from "../../../domain/constants";
import { CreatePermissionProfileDto, UpdatePermissionProfileDto } from "../../../domain/dtos";
import { ErrorService } from "../../services/error.service";
import type { PermissionProfileService } from "../../services/auth/permission-profile.service";

export class PermissionProfileController {
  constructor(private readonly service: PermissionProfileService) {}

  /** The sections a profile can include, for the dashboard form. */
  modules = (_req: Request, res: Response) => res.status(200).json({ modules: USER_MODULES });

  create = async (req: Request, res: Response) => {
    try {
      const [error, dto] = CreatePermissionProfileDto.create(req.body ?? {});
      if (error) return res.status(400).json({ error });
      return res.status(201).json({ profile: await this.service.create(dto!) });
    } catch (error) {
      return ErrorService.handleApiError(error, res);
    }
  };

  getAll = async (_req: Request, res: Response) => {
    try {
      return res.status(200).json({ profiles: await this.service.getAll() });
    } catch (error) {
      return ErrorService.handleApiError(error, res);
    }
  };

  getById = async (req: Request, res: Response) => {
    try {
      return res.status(200).json({ profile: await this.service.getById(String(req.params.id)) });
    } catch (error) {
      return ErrorService.handleApiError(error, res);
    }
  };

  update = async (req: Request, res: Response) => {
    try {
      const [error, dto] = UpdatePermissionProfileDto.create(req.body ?? {});
      if (error) return res.status(400).json({ error });
      return res.status(200).json({ profile: await this.service.update(String(req.params.id), dto!) });
    } catch (error) {
      return ErrorService.handleApiError(error, res);
    }
  };

  delete = async (req: Request, res: Response) => {
    try {
      return res.status(200).json({ profile: await this.service.delete(String(req.params.id)) });
    } catch (error) {
      return ErrorService.handleApiError(error, res);
    }
  };
}
