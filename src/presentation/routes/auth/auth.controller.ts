import type { Request, Response } from "express";
import { ForgotPasswordDto, LoginDto, ResetPasswordDto } from "../../../domain/dtos";
import { requestUserId } from "../../middlewares/auth.middleware";
import type { AuthService } from "../../services/auth/auth.service";
import { ErrorService } from "../../services/error.service";

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  login = async (req: Request, res: Response) => {
    try {
      const [error, dto] = LoginDto.create(req.body ?? {});
      if (error) return res.status(400).json({ error });
      return res.status(200).json(await this.authService.login(dto!));
    } catch (error) {
      return ErrorService.handleApiError(error, res);
    }
  };

  renew = async (req: Request, res: Response) => {
    try {
      return res.status(200).json(await this.authService.renew(requestUserId(req)));
    } catch (error) {
      return ErrorService.handleApiError(error, res);
    }
  };

  forgotPassword = async (req: Request, res: Response) => {
    try {
      const [error, dto] = ForgotPasswordDto.create(req.body ?? {});
      if (error) return res.status(400).json({ error });
      return res.status(200).json(await this.authService.forgotPassword(dto!));
    } catch (error) {
      return ErrorService.handleApiError(error, res);
    }
  };

  resetPassword = async (req: Request, res: Response) => {
    try {
      const [error, dto] = ResetPasswordDto.create(req.body ?? {});
      if (error) return res.status(400).json({ error });
      return res.status(200).json(await this.authService.resetPassword(dto!));
    } catch (error) {
      return ErrorService.handleApiError(error, res);
    }
  };

  renderResetPasswordPage = async (req: Request, res: Response) => {
    try {
      const { statusCode, html } = await this.authService.getResetPasswordPage(String(req.params.token ?? "").trim());
      return res.status(statusCode).type("html").send(html);
    } catch (error) {
      return ErrorService.handleApiError(error, res);
    }
  };
}
