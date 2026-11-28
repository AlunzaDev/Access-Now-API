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
import { EventService } from "../../application/services/event/event.service";
import { TicketService } from "../../application/services/ticket/ticket.service";
import { TicketCatalogService } from "../../application/services/ticket/ticket-catalog.service";
import { TicketDocumentService } from "../../application/services/ticket/ticket-document.service";
import { VenueService } from "../../application/services/venue/venue.service";
import { PdfkitTicketDocumentRenderer } from "../../infrastructure/document/pdfkit-ticket-document.renderer";
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
import { EventController } from "../routes/event/event.controller";
import { TicketController } from "../routes/ticket/ticket.controller";
import { TicketCatalogController } from "../routes/ticket/ticket-catalog.controller";
import { TicketDocumentController } from "../routes/ticket/ticket-document.controller";
import { VenueController } from "../routes/venue/venue.controller";
import {
  buildPermissionProfileRepository,
  buildDeviceCommandRepository,
  buildDeviceRepository,
  buildProjectRepository,
  buildUserRepository,
  buildEventRepository,
  buildTicketCatalogRepository,
  buildTicketDeliveryRepository,
  buildTicketRepository,
  buildVenueRepository,
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

export const buildEventController = () =>
  new EventController(new EventService(buildEventRepository(), buildFileStorage(), buildTicketRepository()));

export const buildTicketDocumentService = () =>
  new TicketDocumentService(
    buildTicketDeliveryRepository(),
    new PdfkitTicketDocumentRenderer(),
    new NodemailerEmailSender(),
    envs.TICKET_QR_ENCRYPTION_KEY,
  );

export const buildTicketDocumentController = () => new TicketDocumentController(buildTicketDocumentService());

export const buildTicketCatalogController = () =>
  new TicketCatalogController(new TicketCatalogService(buildTicketCatalogRepository()));

export const buildTicketController = () =>
  new TicketController(new TicketService(buildTicketRepository(), envs.TICKET_QR_ENCRYPTION_KEY));

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
    new DeviceService(
      buildDeviceRepository(),
      buildVenueRepository(),
      buildDeviceCommandService(),
      envs.DEVICE_OFFLINE_AFTER_MS,
    ),
    buildGatewayService(),
  );

export const buildVenueController = () => new VenueController(new VenueService(buildVenueRepository()));

/** Marks offline the gateways that stop sending heartbeats (started by the server). */
export const buildDevicePresenceMonitor = () =>
  new DevicePresenceMonitor(buildGatewayService(), envs.DEVICE_PRESENCE_CHECK_MS);
