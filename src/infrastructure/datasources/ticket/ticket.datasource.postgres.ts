import { currentAuditWrite } from "../../../config/audit-context";
import type {
  NewTicketSecret,
  ScanOrigin,
  TicketDatasource,
  TicketListFilters,
} from "../../../domain/datasources/ticket/ticket.datasource";
import type { TicketValues } from "../../../domain/dtos/ticket/ticket.dto";
import { toPage, type Page, type PageRequest } from "../../../domain/dtos/shared/pagination";
import { TicketEntity, type TicketHistoryItem } from "../../../domain/entities/ticket/ticket.entity";
import { CustomError } from "../../../domain/errors/custom.error";
import { accessRejection, canIssueTickets, validateTicketCapacity } from "../../../domain/policies/ticket/ticket-policy";
import type { Prisma, Ticket } from "../../../generated/prisma/client";
import { PostgresDatabase } from "../../prisma/postgres.database";
import { isUuid, withPrismaErrors } from "../../prisma/prisma-errors";

const eventSelect = {
  nombre: true,
  fechaInicio: true,
  fechaFin: true,
  horaInicio: true,
  horaFin: true,
  zonaHoraria: true,
  estado: true,
} as const;

/** Large batches insert in bulk; give the transaction room beyond Prisma's 5 s default. */
const BATCH_TRANSACTION = { timeout: 60_000, maxWait: 10_000 } as const;

type TicketRow = Ticket & { event: Record<string, unknown> };
const toEntity = (row: TicketRow) => TicketEntity.fromObject(row as unknown as Record<string, unknown>);
const activeStatuses = ["DISPONIBLE", "RESERVADO", "VENDIDO"] as const;

const historyItem = (row: {
  id: string;
  tipo: string;
  detalle: unknown;
  terminalId: string | null;
  actorId: string | null;
  actorNombre: string;
  createdAt: Date;
}): TicketHistoryItem => ({
  id: row.id,
  tipo: row.tipo,
  detalle: row.detalle as Record<string, unknown>,
  terminalId: row.terminalId,
  actor: { id: row.actorId, nombre: row.actorNombre },
  creadoEn: row.createdAt.getTime(),
});

export class TicketPostgresDatasource implements TicketDatasource {
  private get client() { return PostgresDatabase.client; }

  private async lockAndValidateCapacity(
    transaction: Prisma.TransactionClient,
    projectId: string,
    eventId: string,
    requested: number,
  ) {
    const rows = await transaction.$queryRaw<Array<{ capacidad: number | null; estado: boolean }>>`
      SELECT capacidad, estado FROM eventos
      WHERE id = ${eventId}::uuid AND proyecto_id = ${projectId}::uuid
      FOR UPDATE
    `;
    if (!rows.length) throw CustomError.notFound("Evento no encontrado");
    const inactive = canIssueTickets(rows[0].estado);
    if (inactive) throw CustomError.conflict(inactive);
    const active = await transaction.ticket.count({
      where: { projectId, eventId, estadoVenta: { in: [...activeStatuses] } },
    });
    const error = validateTicketCapacity(rows[0].capacidad, active, requested);
    if (error) throw CustomError.conflict(error);
  }

  private async createOne(
    transaction: Prisma.TransactionClient,
    projectId: string,
    eventId: string,
    values: TicketValues,
    secret: NewTicketSecret,
  ) {
    const audit = currentAuditWrite();
    return transaction.ticket.create({
      data: {
        ...values,
        projectId,
        eventId,
        folio: secret.folio,
        creadoPorId: audit.actorId,
        creadoPorNombre: audit.actorNombre,
        actualizadoPorId: audit.actorId,
        actualizadoPorNombre: audit.actorNombre,
        credentials: { create: {
          tokenHash: secret.tokenHash,
          tokenCiphertext: secret.tokenCiphertext,
          tokenIv: secret.tokenIv,
          tokenTag: secret.tokenTag,
        } },
        history: {
          create: {
            tipo: values.estadoVenta === "VENDIDO" ? "VENDIDO" : "GENERADO",
            detalle: values.titularNombre ? { titularNombre: values.titularNombre } : {},
            actorId: audit.actorId,
            actorNombre: audit.actorNombre,
          },
        },
      },
      include: { event: { select: eventSelect } },
    });
  }

  async create(projectId: string, eventId: string, values: TicketValues, secret: NewTicketSecret) {
    return withPrismaErrors(() => this.client.$transaction(async (transaction) => {
      await this.lockAndValidateCapacity(transaction, projectId, eventId, 1);
      return toEntity(await this.createOne(transaction, projectId, eventId, values, secret));
    }));
  }

  /**
   * Up to 1000 tickets in three bulk inserts (tickets, credentials, history) inside one
   * transaction: all or nothing, and capacity checked under the event lock.
   */
  async createBatch(projectId: string, eventId: string, secrets: NewTicketSecret[]) {
    return withPrismaErrors(() => this.client.$transaction(async (transaction) => {
      await this.lockAndValidateCapacity(transaction, projectId, eventId, secrets.length);
      const audit = currentAuditWrite();
      const actor = { actorId: audit.actorId, actorNombre: audit.actorNombre };
      const created = await transaction.ticket.createManyAndReturn({
        data: secrets.map((secret) => ({
          projectId,
          eventId,
          folio: secret.folio,
          creadoPorId: audit.actorId,
          creadoPorNombre: audit.actorNombre,
          actualizadoPorId: audit.actorId,
          actualizadoPorNombre: audit.actorNombre,
        })),
        select: { id: true, folio: true },
      });
      const idByFolio = new Map(created.map((row) => [row.folio, row.id]));
      await transaction.ticketCredential.createMany({
        data: secrets.map((secret) => ({
          ticketId: idByFolio.get(secret.folio)!,
          tokenHash: secret.tokenHash,
          tokenCiphertext: secret.tokenCiphertext,
          tokenIv: secret.tokenIv,
          tokenTag: secret.tokenTag,
        })),
      });
      await transaction.ticketEvent.createMany({
        data: created.map((row) => ({ ticketId: row.id, tipo: "GENERADO" as const, detalle: { lote: secrets.length }, ...actor })),
      });
      const rows = await transaction.ticket.findMany({
        where: { id: { in: created.map((row) => row.id) } },
        include: { event: { select: eventSelect } },
      });
      const byFolio = new Map(rows.map((row) => [row.folio, toEntity(row)]));
      return secrets.map((secret) => byFolio.get(secret.folio)!);
    }, BATCH_TRANSACTION));
  }

  async list(filters: TicketListFilters, page: PageRequest): Promise<Page<TicketEntity>> {
    const where: Prisma.TicketWhereInput = {
      projectId: filters.projectId,
      ...(filters.eventId ? { eventId: filters.eventId } : {}),
      ...(filters.estadoVenta ? { estadoVenta: filters.estadoVenta } : {}),
      ...(filters.buscar ? {
        OR: [
          { folio: { contains: filters.buscar, mode: "insensitive" } },
          { titularNombre: { contains: filters.buscar, mode: "insensitive" } },
          { titularCorreo: { contains: filters.buscar, mode: "insensitive" } },
        ],
      } : {}),
    };
    const [rows, total] = await Promise.all([
      this.client.ticket.findMany({
        where,
        include: { event: { select: eventSelect } },
        orderBy: { createdAt: "desc" },
        skip: page.desde,
        take: page.limite,
      }),
      this.client.ticket.count({ where }),
    ]);
    return toPage(rows.map((row) => toEntity(row)), total);
  }

  async findById(projectId: string, id: string) {
    if (!isUuid(id)) return null;
    const row = await this.client.ticket.findFirst({
      where: { id, projectId },
      include: { event: { select: eventSelect } },
    });
    return row ? toEntity(row) : null;
  }

  async update(projectId: string, id: string, values: Partial<TicketValues>) {
    const current = await this.findById(projectId, id);
    if (!current) return null;
    const audit = currentAuditWrite();
    const holderChanged = ["titularNombre", "titularCorreo", "titularTelefono"]
      .some((field) => field in values);
    const eventType = holderChanged
      ? "REASIGNADO"
      : values.estadoVenta === "DISPONIBLE"
        ? "ASIGNADO"
        : values.estadoVenta ?? "ASIGNADO";
    const row = await withPrismaErrors(() => this.client.ticket.update({
      where: { id },
      data: {
        ...values,
        actualizadoPorId: audit.actorId,
        actualizadoPorNombre: audit.actorNombre,
        history: {
          create: {
            tipo: eventType,
            detalle: values,
            actorId: audit.actorId,
            actorNombre: audit.actorNombre,
          },
        },
      },
      include: { event: { select: eventSelect } },
    }));
    return toEntity(row);
  }

  async cancel(projectId: string, id: string) {
    const current = await this.findById(projectId, id);
    if (!current) return null;
    const audit = currentAuditWrite();
    const row = await this.client.ticket.update({
      where: { id },
      data: {
        estadoVenta: "CANCELADO",
        canceladoEn: new Date(),
        actualizadoPorId: audit.actorId,
        actualizadoPorNombre: audit.actorNombre,
        credentials: { updateMany: { where: { revocadoEn: null }, data: { revocadoEn: new Date() } } },
        history: { create: { tipo: "CANCELADO", actorId: audit.actorId, actorNombre: audit.actorNombre } },
      },
      include: { event: { select: eventSelect } },
    });
    return toEntity(row);
  }

  async reissue(projectId: string, id: string, secret: {
    tokenHash: string;
    tokenCiphertext: string;
    tokenIv: string;
    tokenTag: string;
  }) {
    const current = await this.findById(projectId, id);
    if (!current) return null;
    const audit = currentAuditWrite();
    const row = await this.client.ticket.update({
      where: { id },
      data: {
        actualizadoPorId: audit.actorId,
        actualizadoPorNombre: audit.actorNombre,
        credentials: {
          updateMany: { where: { revocadoEn: null }, data: { revocadoEn: new Date() } },
          create: secret,
        },
        history: { create: { tipo: "QR_REEMITIDO", actorId: audit.actorId, actorNombre: audit.actorNombre } },
      },
      include: { event: { select: eventSelect } },
    });
    return toEntity(row);
  }

  async getActiveCredential(projectId: string, id: string) {
    if (!(await this.findById(projectId, id))) return null;
    const credential = await this.client.ticketCredential.findFirst({
      where: { ticketId: id, revocadoEn: null },
      orderBy: { emitidoEn: "desc" },
      select: { tokenCiphertext: true, tokenIv: true, tokenTag: true },
    });
    if (!credential?.tokenCiphertext || !credential.tokenIv || !credential.tokenTag) return null;
    const audit = currentAuditWrite();
    await this.client.ticketEvent.create({ data: {
      ticketId: id,
      tipo: "QR_CONSULTADO",
      actorId: audit.actorId,
      actorNombre: audit.actorNombre,
    } });
    return {
      tokenCiphertext: credential.tokenCiphertext,
      tokenIv: credential.tokenIv,
      tokenTag: credential.tokenTag,
    };
  }

  async history(projectId: string, id: string) {
    if (!(await this.findById(projectId, id))) return null;
    const rows = await this.client.ticketEvent.findMany({ where: { ticketId: id }, orderBy: { createdAt: "desc" } });
    return rows.map(historyItem);
  }

  countByEvent(projectId: string, eventId: string) {
    return this.client.ticket.count({ where: { projectId, eventId } });
  }

  countActive(projectId: string, eventId: string) {
    return this.client.ticket.count({
      where: { projectId, eventId, estadoVenta: { in: [...activeStatuses] } },
    });
  }

  async validateAccess(projectId: string, tokenHash: string, origin: ScanOrigin) {
    return this.client.$transaction(async (transaction) => {
      // SCAT knows its terminals by MAC; only a terminal of that gateway's project is recorded.
      const terminal = origin.terminalMac
        ? await transaction.device.findFirst({
            where: { projectId, tipo: "TERMINAL", mac: origin.terminalMac },
            select: { id: true },
          })
        : null;
      const terminalId = terminal?.id ?? null;
      const scan = { gatewayId: origin.gatewayId, ...(origin.terminalMac ? { terminalMac: origin.terminalMac } : {}) };
      const locked = await transaction.$queryRaw<Array<{ ticket_id: string }>>`
        SELECT bc.boleto_id AS ticket_id
        FROM boleto_credenciales bc
        INNER JOIN boletos b ON b.id = bc.boleto_id
        WHERE bc.token_hash = ${tokenHash}
          AND bc.revocado_en IS NULL
          AND b.proyecto_id = ${projectId}::uuid
        FOR UPDATE OF b
      `;
      if (!locked.length) return null;
      const row = await transaction.ticket.findUniqueOrThrow({
        where: { id: locked[0].ticket_id },
        include: { event: { select: eventSelect } },
      });
      const ticket = toEntity(row);
      const audit = currentAuditWrite();
      const message = accessRejection(ticket.values.estadoAcceso);
      if (message) {
        await transaction.ticketEvent.create({ data: {
          ticketId: ticket.id,
          terminalId,
          tipo: "ACCESO_RECHAZADO",
          detalle: { motivo: message, ...scan },
          actorId: audit.actorId,
          actorNombre: audit.actorNombre,
        } });
        return { ticket, granted: false, message };
      }
      const usedAt = new Date();
      const updated = await transaction.ticket.update({
        where: { id: ticket.id },
        data: {
          usadoEn: usedAt,
          history: { create: {
            tipo: "ACCESO_CONCEDIDO",
            terminalId,
            detalle: scan,
            actorId: audit.actorId,
            actorNombre: audit.actorNombre,
          } },
        },
        include: { event: { select: eventSelect } },
      });
      return { ticket: toEntity(updated), granted: true, message: "Acceso concedido" };
    });
  }
}
