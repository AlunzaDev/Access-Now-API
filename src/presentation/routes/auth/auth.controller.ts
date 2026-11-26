import type { Request, Response } from "express";
import { sessionUser } from "../../../api/middlewares/auth.middleware";
import { ErrorService } from "../../../api/middlewares/error-handler";
import type { AuthService } from "../../../application/services/auth/auth.service";
import { ForgotPasswordDto, LoginDto, ResetPasswordDto } from "../../../domain/dtos";
import { bodyOf, routeParam } from "../shared/route-params";

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  login = async (req: Request, res: Response) => {
    try {
      const [error, dto] = LoginDto.create(bodyOf(req));
      if (error) return ErrorService.send(res, 400, error);
      return res.json(await this.authService.login(dto!));
    } catch (error) {
      return ErrorService.handleApiError(error, res);
    }
  };

  renew = async (req: Request, res: Response) => {
    try {
      return res.json(await this.authService.renew(sessionUser(req).id));
    } catch (error) {
      return ErrorService.handleApiError(error, res);
    }
  };

  forgotPassword = async (req: Request, res: Response) => {
    try {
      const [error, dto] = ForgotPasswordDto.create(bodyOf(req));
      if (error) return ErrorService.send(res, 400, error);
      return res.json(await this.authService.forgotPassword(dto!));
    } catch (error) {
      return ErrorService.handleApiError(error, res);
    }
  };

  resetPassword = async (req: Request, res: Response) => {
    try {
      const [error, dto] = ResetPasswordDto.create(bodyOf(req));
      if (error) return ErrorService.send(res, 400, error);
      return res.json(await this.authService.resetPassword(dto!));
    } catch (error) {
      return ErrorService.handleApiError(error, res);
    }
  };

  renderResetPasswordPage = async (req: Request, res: Response) => {
    try {
      const { statusCode, html } = await this.authService.getResetPasswordPage(routeParam(req, "token"));
      return res.status(statusCode).type("html").send(html);
    } catch (error) {
      return ErrorService.handleApiError(error, res);
    }
  };
}
