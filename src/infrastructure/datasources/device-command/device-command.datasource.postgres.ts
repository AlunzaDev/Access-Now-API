import { currentAuditWrite } from "../../../config/audit-context";
import type {
  CommandOutcome,
  DeviceCommandDatasource,
  DeviceCommandFilters,
  NewDeviceCommand,
} from "../../../domain/datasources/device-command/device-command.datasource";
import { toPage, type Page, type PageRequest } from "../../../domain/dtos/shared/pagination";
import type { DeviceCommand, DeviceCommandPayload } from "../../../domain/entities/device/device-command.entity";
import type { DeviceCommand as DeviceCommandRow, Prisma } from "../../../generated/prisma/client";
import { PostgresDatabase } from "../../prisma/postgres.database";
import { isUuid } from "../../prisma/prisma-errors";

const toCommand = (row: DeviceCommandRow): DeviceCommand => ({
  id: row.id,
  gatewayId: row.gatewayId,
  terminalId: row.terminalId,
  tipo: row.tipo,
  estado: row.estado,
  payload: row.payload as DeviceCommandPayload,
  resultado: (row.resultado ?? {}) as Record<string, unknown>,
  error: row.error,
  intentos: row.intentos,
  entregadoEn: row.entregadoEn?.getTime() ?? null,
  finalizadoEn: row.finalizadoEn?.getTime() ?? null,
  creadoPor: { id: row.creadoPorId, nombre: row.creadoPorNombre },
  creadoEn: row.createdAt.getTime(),
  actualizadoPor: { id: row.actualizadoPorId, nombre: row.actualizadoPorNombre },
  actualizadoEn: row.updatedAt.getTime(),
});

const terminalMac = (payload: DeviceCommandPayload) => ("terminal" in payload ? payload.terminal.mac : null);

export class DeviceCommandPostgresDatasource implements DeviceCommandDatasource {
  private get commands() {
    return PostgresDatabase.client.deviceCommand;
  }

  async enqueue(command: NewDeviceCommand): Promise<DeviceCommand> {
    const audit = currentAuditWrite();
    const now = new Date();
    const mac = terminalMac(command.payload);
    // Pending commands this one replaces: the same terminal (by MAC) on the same gateway, or a
    // previous SINCRONIZAR. Delivered ones are left alone: the gateway may be running them.
    const superseded: Prisma.DeviceCommandWhereInput = {
      gatewayId: command.gatewayId,
      estado: "PENDIENTE",
      ...(mac
        ? { tipo: { in: ["CONFIGURAR_TERMINAL", "ELIMINAR_TERMINAL"] }, payload: { path: ["terminal", "mac"], equals: mac } }
        : { tipo: "SINCRONIZAR" }),
    };
    const row = await PostgresDatabase.client.$transaction(async (tx) => {
      await tx.deviceCommand.updateMany({
        where: superseded,
        data: {
          estado: "CANCELADO",
          error: "Reemplazado por un cambio más reciente",
          finalizadoEn: now,
          actualizadoPorId: audit.actorId,
          actualizadoPorNombre: audit.actorNombre,
        },
      });
      return tx.deviceCommand.create({
        data: {
          gatewayId: command.gatewayId,
          terminalId: command.terminalId,
          tipo: command.tipo,
          payload: command.payload as unknown as Prisma.InputJsonObject,
          creadoPorId: audit.actorId,
          creadoPorNombre: audit.actorNombre,
          actualizadoPorId: audit.actorId,
          actualizadoPorNombre: audit.actorNombre,
        },
      });
    });
    return toCommand(row);
  }

  async findById(projectId: string, id: string): Promise<DeviceCommand | null> {
    if (!isUuid(id)) return null;
    const row = await this.commands.findFirst({ where: { id, gateway: { projectId } } });
    return row ? toCommand(row) : null;
  }

  async list({ projectId, gatewayId, terminalId }: DeviceCommandFilters, { desde, limite }: PageRequest): Promise<Page<DeviceCommand>> {
    const where: Prisma.DeviceCommandWhereInput = {
      gateway: { projectId },
      ...(gatewayId ? { gatewayId } : {}),
      ...(terminalId ? { terminalId } : {}),
    };
    const [rows, total] = await Promise.all([
      this.commands.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: desde, take: limite }),
      this.commands.count({ where }),
    ]);
    return toPage(rows.map(toCommand), total);
  }

  async listOpen(gatewayId: string): Promise<DeviceCommand[]> {
    const rows = await this.commands.findMany({
      where: { gatewayId, estado: { in: ["PENDIENTE", "ENTREGADO"] } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    return rows.map(toCommand);
  }

  async markDelivered({ id, estado, intentos }: Pick<DeviceCommand, "id" | "estado" | "intentos">, at: Date): Promise<boolean> {
    // `intentos` works as a version: each delivery increments it, so a stale read matches nothing.
    const { count } = await this.commands.updateMany({
      where: { id, estado, intentos },
      data: { estado: "ENTREGADO", intentos: { increment: 1 }, entregadoEn: at },
    });
    return count === 1;
  }

  async finish(gatewayId: string, id: string, outcome: CommandOutcome): Promise<DeviceCommand | null> {
    const audit = currentAuditWrite();
    const { count } = await this.commands.updateMany({
      where: { id, gatewayId, estado: "ENTREGADO" },
      data: {
        estado: outcome.estado,
        resultado: outcome.resultado as Prisma.InputJsonObject,
        error: outcome.error,
        finalizadoEn: new Date(),
        actualizadoPorId: audit.actorId,
        actualizadoPorNombre: audit.actorNombre,
      },
    });
    if (count === 0) return null;
    return toCommand(await this.commands.findUniqueOrThrow({ where: { id } }));
  }

  async cancel(id: string): Promise<DeviceCommand | null> {
    const audit = currentAuditWrite();
    const { count } = await this.commands.updateMany({
      where: { id, estado: "PENDIENTE" },
      data: {
        estado: "CANCELADO",
        error: "Cancelado desde el dashboard",
        finalizadoEn: new Date(),
        actualizadoPorId: audit.actorId,
        actualizadoPorNombre: audit.actorNombre,
      },
    });
    if (count === 0) return null;
    return toCommand(await this.commands.findUniqueOrThrow({ where: { id } }));
  }
}
