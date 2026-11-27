import type { Request, Response } from "express";
import { ErrorService } from "../../../api/middlewares/errors/error-handler";
import type { DeviceService } from "../../../application/services/device/device.service";
import type { GatewayService } from "../../../application/services/device/gateway.service";
import { requestGateway } from "../../../api/middlewares/gateway/gateway-auth.middleware";
import { HeartbeatDto } from "../../../domain/dtos/device/heartbeat.dto";
import { CreateDeviceDto, parsePagination, parseSearch, UpdateDeviceDto } from "../../../domain/dtos";
import { DEVICE_TYPES, type DeviceType } from "../../../domain/entities/device/device.entity";
import { bodyOf, queryOf, routeParam } from "../shared/route-params";

export class DeviceController {
  constructor(
    private readonly service: DeviceService,
    private readonly gateways: GatewayService,
  ) {}

  list = async (request: Request, response: Response) => {
    try {
      const query = queryOf(request);
      if (query.tipo !== undefined && !DEVICE_TYPES.includes(query.tipo as DeviceType)) {
        return ErrorService.send(response, 400, "'tipo' debe ser GATEWAY o TERMINAL");
      }
      const tipo = DEVICE_TYPES.includes(query.tipo as DeviceType) ? (query.tipo as DeviceType) : undefined;
      return response.json(
        await this.service.list(
          routeParam(request, "proyectoId"),
          {
            tipo,
            gatewayId: typeof query.gatewayId === "string" ? query.gatewayId.trim() : undefined,
            buscar: parseSearch(query.buscar),
          },
          parsePagination(query),
        ),
      );
    } catch (error) {
      return ErrorService.handleApiError(error, response);
    }
  };

  create = async (request: Request, response: Response) => {
    try {
      const [error, dto] = CreateDeviceDto.create(bodyOf(request));
      if (error) return ErrorService.send(response, 400, error);
      return response.status(201).json(await this.service.create(routeParam(request, "proyectoId"), dto!));
    } catch (error) {
      return ErrorService.handleApiError(error, response);
    }
  };

  getById = async (request: Request, response: Response) => {
    try {
      return response.json(
        await this.service.getById(routeParam(request, "proyectoId"), routeParam(request, "id")),
      );
    } catch (error) {
      return ErrorService.handleApiError(error, response);
    }
  };

  update = async (request: Request, response: Response) => {
    try {
      const [error, dto] = UpdateDeviceDto.create(bodyOf(request));
      if (error) return ErrorService.send(response, 400, error);
      return response.json(
        await this.service.update(
          routeParam(request, "proyectoId"),
          routeParam(request, "id"),
          dto!,
        ),
      );
    } catch (error) {
      return ErrorService.handleApiError(error, response);
    }
  };

  delete = async (request: Request, response: Response) => {
    try {
      return response.json(
        await this.service.delete(routeParam(request, "proyectoId"), routeParam(request, "id")),
      );
    } catch (error) {
      return ErrorService.handleApiError(error, response);
    }
  };

  createEnrollmentToken = async (request: Request, response: Response) => {
    try {
      return response.json(
        await this.service.createEnrollmentToken(
          routeParam(request, "proyectoId"),
          routeParam(request, "id"),
          {
            vigenciaHoras: Number(bodyOf(request).vigenciaHoras ?? 24),
            duracionEnrolamientoDias: bodyOf(request).duracionEnrolamientoDias === null
              ? null
              : Number(bodyOf(request).duracionEnrolamientoDias ?? 30),
          },
        ),
      );
    } catch (error) {
      return ErrorService.handleApiError(error, response);
    }
  };

  enroll = async (request: Request, response: Response) => {
    try {
      const body = bodyOf(request);
      const token = typeof body.token === "string" ? body.token.trim() : "";
      const fingerprint = typeof body.device_fingerprint === "string" ? body.device_fingerprint.trim() : "";
      const deviceName = typeof body.device_name === "string" ? body.device_name.trim() : "";
      if (!token || !fingerprint || !deviceName) {
        return ErrorService.send(response, 400, "token, device_fingerprint y device_name son requeridos");
      }
      return response.json(await this.gateways.enroll(token, fingerprint, deviceName));
    } catch (error) {
      return ErrorService.handleApiError(error, response);
    }
  };

  status = async (request: Request, response: Response) => {
    try {
      return response.json(await this.service.status(routeParam(request, "proyectoId"), routeParam(request, "id")));
    } catch (error) {
      return ErrorService.handleApiError(error, response);
    }
  };

  history = async (request: Request, response: Response) => {
    try {
      const page = parsePagination(queryOf(request), 20);
      return response.json(
        await this.service.history(routeParam(request, "proyectoId"), routeParam(request, "id"), page),
      );
    } catch (error) {
      return ErrorService.handleApiError(error, response);
    }
  };

  revokeEnrollment = async (request: Request, response: Response) => {
    try {
      return response.json(
        await this.service.revokeEnrollment(routeParam(request, "proyectoId"), routeParam(request, "id")),
      );
    } catch (error) {
      return ErrorService.handleApiError(error, response);
    }
  };

  /** Gateway: SINCRONIZAR all its active terminals. Terminal: send its configuration again. */
  sync = async (request: Request, response: Response) => {
    try {
      return response
        .status(201)
        .json(await this.service.sync(routeParam(request, "proyectoId"), routeParam(request, "id")));
    } catch (error) {
      return ErrorService.handleApiError(error, response);
    }
  };

  commands = async (request: Request, response: Response) => {
    try {
      const page = parsePagination(queryOf(request), 20);
      return response.json(
        await this.service.listCommands(routeParam(request, "proyectoId"), routeParam(request, "id"), page),
      );
    } catch (error) {
      return ErrorService.handleApiError(error, response);
    }
  };

  cancelCommand = async (request: Request, response: Response) => {
    try {
      return response.json(
        await this.service.cancelCommand(
          routeParam(request, "proyectoId"),
          routeParam(request, "id"),
          routeParam(request, "comandoId"),
        ),
      );
    } catch (error) {
      return ErrorService.handleApiError(error, response);
    }
  };

  /** GET /api/v1/me (gateway token): SCAT checks that its enrollment is still valid. */
  me = (request: Request, response: Response) => response.json(this.gateways.me(requestGateway(request)));

  /** POST /api/v1/device/heartbeat (gateway token). */
  heartbeat = async (request: Request, response: Response) => {
    try {
      const [error, dto] = HeartbeatDto.create(bodyOf(request));
      if (error) return ErrorService.send(response, 400, error);
      const sourceIp = request.ip ?? request.socket.remoteAddress ?? "";
      return response.json(await this.gateways.heartbeat(requestGateway(request), dto!, sourceIp));
    } catch (error) {
      return ErrorService.handleApiError(error, response);
    }
  };
}
