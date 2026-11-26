import type { Request, Response } from "express";
import { CreateUsuarioDto, UpdateUsuarioDto } from "../../../domain/dtos";
import { requestUserId } from "../../middlewares/auth.middleware";
import { ErrorService } from "../../services/error.service";
import type { UsuarioService } from "../../services/auth/usuario.service";

export class UsuarioController {
  constructor(private readonly usuarioService: UsuarioService) {}

  create = async (req: Request, res: Response) => {
    try {
      const [error, dto] = CreateUsuarioDto.create(req.body ?? {});
      if (error) return res.status(400).json({ error });
      return res.status(201).json({ usuario: await this.usuarioService.create(dto!) });
    } catch (error) {
      return ErrorService.handleApiError(error, res);
    }
  };

  getAll = async (_req: Request, res: Response) => {
    try {
      return res.status(200).json({ usuarios: await this.usuarioService.getAll() });
    } catch (error) {
      return ErrorService.handleApiError(error, res);
    }
  };

  getById = async (req: Request, res: Response) => {
    try {
      return res.status(200).json({ usuario: await this.usuarioService.getById(String(req.params.id)) });
    } catch (error) {
      return ErrorService.handleApiError(error, res);
    }
  };

  update = async (req: Request, res: Response) => {
    try {
      const [error, dto] = UpdateUsuarioDto.create(req.body ?? {});
      if (error) return res.status(400).json({ error });
      const usuario = await this.usuarioService.update(String(req.params.id), requestUserId(req), dto!);
      return res.status(200).json({ usuario });
    } catch (error) {
      return ErrorService.handleApiError(error, res);
    }
  };

  delete = async (req: Request, res: Response) => {
    try {
      const usuario = await this.usuarioService.delete(String(req.params.id), requestUserId(req));
      return res.status(200).json({ usuario });
    } catch (error) {
      return ErrorService.handleApiError(error, res);
    }
  };
}
