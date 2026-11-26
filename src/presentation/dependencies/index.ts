// The only place where services, middlewares and controllers are created (`new`).
// Routes ask for what they need with build*(); nothing else instantiates classes.
import { createAuthMiddleware } from "../../api/middlewares/auth/auth.middleware";
import { AuthService } from "../../application/services/auth/auth.service";
import { SessionService } from "../../application/services/auth/session.service";
import { ProjectService } from "../../application/services/project/project.service";
import { PermissionProfileService } from "../../application/services/permission-profile/permission-profile.service";
import { UserService } from "../../application/services/user/user.service";
import { envs } from "../../config";
import { NodemailerEmailSender } from "../../infrastructure/email/nodemailer-email.sender";
import { AuthController } from "../routes/auth/auth.controller";
import { HealthController } from "../routes/health/health.controller";
import { ProjectController } from "../routes/project/project.controller";
import { PermissionProfileController } from "../routes/permission-profile/permission-profile.controller";
import { UserController } from "../routes/user/user.controller";
import {
  buildPermissionProfileRepository,
  buildProjectRepository,
  buildUserRepository,
} from "./repositories/repositories.dependencies";

const buildSessionService = () =>
  new SessionService(buildUserRepository(), buildPermissionProfileRepository(), buildProjectRepository());

export const buildAuthMiddleware = () => createAuthMiddleware(buildSessionService());

export const buildAuthController = () =>
  new AuthController(
    new AuthService(buildUserRepository(), buildSessionService(), new NodemailerEmailSender(), envs.WEB_SERVICE_URL),
  );

export const buildUserController = () =>
  new UserController(
    new UserService(buildUserRepository(), buildPermissionProfileRepository(), buildProjectRepository()),
  );

export const buildPermissionProfileController = () =>
  new PermissionProfileController(new PermissionProfileService(buildPermissionProfileRepository(), buildUserRepository()));

export const buildProjectController = () => new ProjectController(new ProjectService(buildProjectRepository()));

export const buildHealthController = () => new HealthController();
