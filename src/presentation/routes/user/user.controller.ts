import type { Request, Response } from "express";
import { sessionActor } from "../../../api/middlewares/auth/auth.middleware";
import { ErrorService } from "../../../api/middlewares/errors/error-handler";
import type { UserService } from "../../../application/services/user/user.service";
import { CreateUserDto, parsePagination, parseSearch, UpdateUserDto } from "../../../domain/dtos";
import { bodyOf, queryOf, routeParam } from "../shared/route-params";

export class UserController {
  constructor(private readonly userService: UserService) {}

  create = async (req: Request, res: Response) => {
    try {
      const [error, dto] = CreateUserDto.create(bodyOf(req));
      if (error) return ErrorService.send(res, 400, error);
      return res.status(201).json(await this.userService.create(sessionActor(req), dto!));
    } catch (error) {
      return ErrorService.handleApiError(error, res);
    }
  };

  list = async (req: Request, res: Response) => {
    try {
      const query = queryOf(req);
      return res.json(await this.userService.list(sessionActor(req), { buscar: parseSearch(query.buscar) }, parsePagination(query)));
    } catch (error) {
      return ErrorService.handleApiError(error, res);
    }
  };

  getById = async (req: Request, res: Response) => {
    try {
      return res.json(await this.userService.getById(sessionActor(req), routeParam(req, "id")));
    } catch (error) {
      return ErrorService.handleApiError(error, res);
    }
  };

  update = async (req: Request, res: Response) => {
    try {
      const [error, dto] = UpdateUserDto.create(bodyOf(req));
      if (error) return ErrorService.send(res, 400, error);
      return res.json(await this.userService.update(sessionActor(req), routeParam(req, "id"), dto!));
    } catch (error) {
      return ErrorService.handleApiError(error, res);
    }
  };

  delete = async (req: Request, res: Response) => {
    try {
      return res.json(await this.userService.delete(sessionActor(req), routeParam(req, "id")));
    } catch (error) {
      return ErrorService.handleApiError(error, res);
    }
  };
}
