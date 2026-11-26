// The only place where services, middlewares and controllers are created (`new`).
// Routes ask for what they need with build*(); nothing else instantiates classes.
import { createAuthMiddleware } from "../../api/middlewares/auth/auth.middleware";
import { AuthService } from "../../application/services/auth/auth.service";
import { SessionService } from "../../application/services/auth/session.service";
import { ProjectService } from "../../application/services/project/project.service";
import { PermissionProfileService } from "../../application/services/permission-profile/permission-profile.service";
import { UserService } from "../../application/services/user/user.service";
import { DeviceService } from "../../application/services/device/device.service";
import { DevicePresenceMonitor } from "../../application/services/device/device-presence.monitor";
import { GatewayService } from "../../application/services/device/gateway.service";
import { DeviceCommandService } from "../../application/services/device/device-command.service";
import { createGatewayAuthMiddleware } from "../../api/middlewares/gateway/gateway-auth.middleware";
import { envs } from "../../config";
import { NodemailerEmailSender } from "../../infrastructure/email/nodemailer-email.sender";
import { LocalFileStorage, SpacesFileStorage } from "../../infrastructure/storage";
import { AuthController } from "../routes/auth/auth.controller";
import { HealthController } from "../routes/health/health.controller";
import { ProjectController } from "../routes/project/project.controller";
import { PermissionProfileController } from "../routes/permission-profile/permission-profile.controller";
import { UserController } from "../routes/user/user.controller";
import { DeviceController } from "../routes/device/device.controller";
import {
  buildPermissionProfileRepository,
  buildDeviceCommandRepository,
  buildDeviceRepository,
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
  new PermissionProfileController(
    new PermissionProfileService(buildPermissionProfileRepository(), buildUserRepository()),
  );

const buildFileStorage = () => {
  const configured = [
    envs.SPACES_KEY,
    envs.SPACES_SECRET,
    envs.SPACES_BUCKET,
    envs.SPACES_REGION,
    envs.SPACES_ENDPOINT,
  ].every(Boolean);

  return configured
    ? new SpacesFileStorage({
        key: envs.SPACES_KEY,
        secret: envs.SPACES_SECRET,
        bucket: envs.SPACES_BUCKET,
        region: envs.SPACES_REGION,
        endpoint: envs.SPACES_ENDPOINT,
        cdnUrl: envs.SPACES_CDN_URL,
      })
    : new LocalFileStorage(envs.PUBLIC_PATH, envs.WEB_SERVICE_URL);
};

export const buildProjectController = () =>
  new ProjectController(new ProjectService(buildProjectRepository(), buildFileStorage()));

export const buildHealthController = () => new HealthController();

/** Commands per heartbeat answer: a big change reaches the Raspberry in small batches. */
const COMMANDS_PER_HEARTBEAT = 20;

const buildDeviceCommandService = () =>
  new DeviceCommandService(buildDeviceCommandRepository(), buildDeviceRepository(), {
    retryAfterMs: envs.DEVICE_COMMAND_RETRY_MS,
    maxAttempts: envs.DEVICE_COMMAND_MAX_ATTEMPTS,
    batchSize: COMMANDS_PER_HEARTBEAT,
  });

export const buildGatewayService = () =>
  new GatewayService(buildDeviceRepository(), buildDeviceCommandService(), {
    offlineAfterMs: envs.DEVICE_OFFLINE_AFTER_MS,
    heartbeatIntervalMs: envs.DEVICE_HEARTBEAT_INTERVAL_MS,
  });

export const buildGatewayAuthMiddleware = () => createGatewayAuthMiddleware(buildGatewayService());

export const buildDeviceController = () =>
  new DeviceController(
    new DeviceService(buildDeviceRepository(), buildDeviceCommandService(), envs.DEVICE_OFFLINE_AFTER_MS),
    buildGatewayService(),
  );

/** Marks offline the gateways that stop sending heartbeats (started by the server). */
export const buildDevicePresenceMonitor = () =>
  new DevicePresenceMonitor(buildGatewayService(), envs.DEVICE_PRESENCE_CHECK_MS);
