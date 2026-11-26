import { envs } from "../../config";
import { AuthController } from "../routes/auth/auth.controller";
import { PermissionProfileController } from "../routes/auth/permission-profile.controller";
import { UsuarioController } from "../routes/auth/usuario.controller";
import { AuthService } from "../services/auth/auth.service";
import { PermissionProfileService } from "../services/auth/permission-profile.service";
import { SessionResolver } from "../services/auth/session.resolver";
import { UsuarioService } from "../services/auth/usuario.service";
import { EmailService } from "../services/email/email.service";
import { buildPermissionProfileRepository, buildUsuarioRepository } from "./repositories.dependencies";

const buildSessionResolver = () => new SessionResolver(buildPermissionProfileRepository());

export const buildAuthController = (): AuthController =>
  new AuthController(
    new AuthService(buildUsuarioRepository(), buildSessionResolver(), new EmailService(), envs.WEB_SERVICE_URL),
  );

export const buildUsuarioController = (): UsuarioController =>
  new UsuarioController(new UsuarioService(buildUsuarioRepository(), buildPermissionProfileRepository()));

export const buildPermissionProfileController = (): PermissionProfileController =>
  new PermissionProfileController(
    new PermissionProfileService(buildPermissionProfileRepository(), buildUsuarioRepository()),
  );
