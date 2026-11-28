import type { Request, Response } from "express";
import { ErrorService } from "../../../api/middlewares/errors/error-handler";
import type { VenueService } from "../../../application/services/venue/venue.service";
import type { VenueDoorInput } from "../../../domain/datasources/venue/venue.datasource";
import { bodyOf, routeParam } from "../shared/route-params";

const readDoor = (body: Record<string, unknown>, partial = false): [string?, Partial<VenueDoorInput>?] => {
  const allowed = new Set(["nombre", "descripcion", "estado", "zonaIds"]);
  const extra = Object.keys(body).filter((field) => !allowed.has(field));
  if (extra.length > 0) return [`Campos no permitidos: ${extra.join(", ")}`];
  const input: Partial<VenueDoorInput> = {};
  if (!partial || body.nombre !== undefined) {
    if (typeof body.nombre !== "string" || !body.nombre.trim()) return ["'nombre' es requerido"];
    input.nombre = body.nombre.trim();
  }
  if (body.descripcion !== undefined) {
    if (typeof body.descripcion !== "string") return ["'descripcion' debe ser texto"];
    input.descripcion = body.descripcion.trim();
  } else if (!partial) input.descripcion = "";
  if (body.estado !== undefined) {
    if (typeof body.estado !== "boolean") return ["'estado' debe ser boolean"];
    input.estado = body.estado;
  } else if (!partial) input.estado = true;
  if (body.zonaIds !== undefined) {
    if (!Array.isArray(body.zonaIds) || body.zonaIds.some((id) => typeof id !== "string")) {
      return ["'zonaIds' debe ser una lista de identificadores"];
    }
    input.zonaIds = [...new Set(body.zonaIds as string[])];
  } else if (!partial) input.zonaIds = [];
  return [undefined, input];
};

const readCatalog = (body: Record<string, unknown>, partial = false) => {
  const allowed = new Set(["nombre", "descripcion", "estado"]);
  const extra = Object.keys(body).filter((field) => !allowed.has(field));
  if (extra.length > 0) return [`Campos no permitidos: ${extra.join(", ")}`] as const;
  const input: { nombre?: string; descripcion?: string; estado?: boolean } = {};
  if (!partial || body.nombre !== undefined) {
    if (typeof body.nombre !== "string" || !body.nombre.trim()) return ["'nombre' es requerido"] as const;
    input.nombre = body.nombre.trim();
  }
  if (body.descripcion !== undefined) {
    if (typeof body.descripcion !== "string") return ["'descripcion' debe ser texto"] as const;
    input.descripcion = body.descripcion.trim();
  }
  if (body.estado !== undefined) {
    if (typeof body.estado !== "boolean") return ["'estado' debe ser boolean"] as const;
    input.estado = body.estado;
  } else if (!partial) input.estado = true;
  return [undefined, input] as const;
};

export class VenueController {
  constructor(private readonly service: VenueService) {}

  getLayout = async (req: Request, res: Response) => {
    try {
      return res.json(await this.service.getLayout(routeParam(req, "proyectoId")));
    } catch (error) {
      return ErrorService.handleApiError(error, res);
    }
  };

  createDoor = async (req: Request, res: Response) => {
    try {
      const [error, input] = readDoor(bodyOf(req));
      if (error) return ErrorService.send(res, 400, error);
      return res.status(201).json(await this.service.createDoor(
        routeParam(req, "proyectoId"),
        input as VenueDoorInput,
      ));
    } catch (error) {
      return ErrorService.handleApiError(error, res);
    }
  };

  updateDoor = async (req: Request, res: Response) => {
    try {
      const [error, input] = readDoor(bodyOf(req), true);
      if (error) return ErrorService.send(res, 400, error);
      return res.json(await this.service.updateDoor(
        routeParam(req, "proyectoId"),
        routeParam(req, "id"),
        input!,
      ));
    } catch (error) {
      return ErrorService.handleApiError(error, res);
    }
  };

  deleteDoor = async (req: Request, res: Response) => {
    try {
      return res.json(await this.service.deleteDoor(routeParam(req, "proyectoId"), routeParam(req, "id")));
    } catch (error) {
      return ErrorService.handleApiError(error, res);
    }
  };

  createCatalog = (type: "zone" | "section" | "row" | "seat", parentParam?: string) =>
    async (req: Request, res: Response) => {
      try {
        const [error, input] = readCatalog(bodyOf(req));
        if (error) return ErrorService.send(res, 400, error);
        return res.status(201).json(await this.service.createCatalog(
          routeParam(req, "proyectoId"),
          type,
          parentParam ? routeParam(req, parentParam) : null,
          { nombre: input!.nombre!, descripcion: input!.descripcion, estado: input!.estado! },
        ));
      } catch (error) {
        return ErrorService.handleApiError(error, res);
      }
    };

  updateCatalog = (type: "zone" | "section" | "row" | "seat") => async (req: Request, res: Response) => {
    try {
      const [error, input] = readCatalog(bodyOf(req), true);
      if (error) return ErrorService.send(res, 400, error);
      return res.json(await this.service.updateCatalog(
        routeParam(req, "proyectoId"),
        type,
        routeParam(req, "id"),
        input!,
      ));
    } catch (error) {
      return ErrorService.handleApiError(error, res);
    }
  };

  deleteCatalog = (type: "zone" | "section" | "row" | "seat") => async (req: Request, res: Response) => {
    try {
      return res.json(await this.service.deleteCatalog(
        routeParam(req, "proyectoId"),
        type,
        routeParam(req, "id"),
      ));
    } catch (error) {
      return ErrorService.handleApiError(error, res);
    }
  };
}
