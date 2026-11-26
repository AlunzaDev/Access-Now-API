import { Router } from "express";
import { envs } from "../../../config";
import { buildAuthController } from "../../dependencies";
import { AuthMiddleware, loginAttemptLimiter, rateLimitMiddleware } from "../../middlewares";

export class AuthRoutes {
  static get routes(): Router {
    const router = Router();
    const controller = buildAuthController();

    const loginLimit = loginAttemptLimiter({
      windowMs: envs.AUTH_LOGIN_WINDOW_MS,
      maxFailuresPerAccount: envs.AUTH_LOGIN_MAX_FAILURES,
      maxFailuresPerIp: envs.AUTH_LOGIN_IP_MAX_FAILURES,
      accountField: "correo",
    });
    const strictLimit = rateLimitMiddleware({ windowMs: 15 * 60 * 1000, maxRequests: 8 });
    const emailLimit = rateLimitMiddleware({ windowMs: 15 * 60 * 1000, maxRequests: 4 });

    router.post("/login", loginLimit, controller.login);
    router.get("/renew", AuthMiddleware.requireAuth, controller.renew);
    router.post("/forgot-password", emailLimit, controller.forgotPassword);
    router.get("/reset-password/:token", controller.renderResetPasswordPage);
    router.post("/reset-password", strictLimit, controller.resetPassword);

    return router;
  }
}
