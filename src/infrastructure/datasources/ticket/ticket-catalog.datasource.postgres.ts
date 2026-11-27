import { currentAuditWrite } from "../../../config/audit-context";
import type {
  CatalogEventRow,
  CatalogTicketRow,
  OfflineScan,
  OfflineScanOutcome,
  TicketCatalogDatasource,
} from "../../../domain/datasources/ticket/ticket-catalog.datasource";
import { offlineScanResult } from "../../../domain/policies/ticket/ticket-catalog-policy";
import type { Prisma } from "../../../generated/prisma/client";
import { PostgresDatabase } from "../../prisma/postgres.database";
import { isUuid } from "../../prisma/prisma-errors";

const dateText = (value: Date) => value.toISOString().slice(0, 10);
const utcDate = (value: string) => new Date(`${value}T00:00:00.000Z`);

const REJECTION_REASON = {
  DUPLICADO: "Usado también en otra puerta sin conexión",
  NO_VALIDO: "Entró sin conexión con un boleto que ya no era válido (cancelado o QR reemitido)",
} as const;

export class TicketCatalogPostgresDatasource implements TicketCatalogDatasource {
  private get client() {
    return PostgresDatabase.client;
  }

  async catalogEvents(projectId: string, fromDate: string, toDate: string): Promise<CatalogEventRow[]> {
    const rows = await this.client.event.findMany({
      where: {
        projectId,
        estado: true,
        fechaFin: { gte: utcDate(fromDate) },
        fechaInicio: { lte: utcDate(toDate) },
      },
      select: {
        id: true,
        nombre: true,
        fechaInicio: true,
        fechaFin: true,
        horaInicio: true,
        horaFin: true,
        zonaHoraria: true,
      },
      orderBy: [{ fechaInicio: "asc" }, { id: "asc" }],
    });
    return rows.map((row) => ({ ...row, fechaInicio: dateText(row.fechaInicio), fechaFin: dateText(row.fechaFin) }));
  }

  async catalogTickets(projectId: string, eventIds: string[], since: Date | null): Promise<CatalogTicketRow[]> {
    if (eventIds.length === 0) return [];
    const where: Prisma.TicketWhereInput = {
      projectId,
      eventId: { in: eventIds.filter(isUuid) },
      // Full download: only sold tickets matter. Changes: every ticket touched since (so the
      // gateway also learns about cancellations and reissued QR codes).
      ...(since ? { updatedAt: { gt: since } } : { estadoVenta: "VENDIDO" }),
    };
    const rows = await this.client.ticket.findMany({
      where,
      select: {
        id: true,
        eventId: true,
        folio: true,
        titularNombre: true,
        estadoVenta: true,
        usadoEn: true,
        credentials: {
          where: { revocadoEn: null },
          orderBy: { emitidoEn: "desc" },
          take: 1,
          select: { tokenHash: true },
        },
      },
      orderBy: { id: "asc" },
    });
    return rows.map(({ credentials, ...row }) => ({ ...row, hash: credentials[0]?.tokenHash ?? null }));
  }

  async applyOfflineScan(projectId: string, gatewayId: string, scan: OfflineScan): Promise<OfflineScanOutcome> {
    return this.client.$transaction(async (transaction) => {
      // The scan may carry a QR revoked since the catalog was downloaded: look it up among all.
      const found = await transaction.$queryRaw<Array<{ ticket_id: string; revocado_en: Date | null }>>`
        SELECT bc.boleto_id AS ticket_id, bc.revocado_en
        FROM boleto_credenciales bc
        INNER JOIN boletos b ON b.id = bc.boleto_id
        WHERE bc.token_hash = ${scan.hash} AND b.proyecto_id = ${projectId}::uuid
        FOR UPDATE OF b
      `;
      if (!found.length) return { hash: scan.hash, resultado: "DESCONOCIDO" };

      const ticketId = found[0].ticket_id;
      const ticket = await transaction.ticket.findUniqueOrThrow({
        where: { id: ticketId },
        select: { estadoVenta: true, usadoEn: true },
      });
      const { result, alreadyRecorded } = offlineScanResult({
        estadoVenta: ticket.estadoVenta,
        usadoEn: ticket.usadoEn?.getTime() ?? null,
        credentialRevoked: found[0].revocado_en !== null,
        scannedAt: scan.scannedAt.getTime(),
      });
      if (alreadyRecorded) return { hash: scan.hash, resultado: result };

      const escaneadoEn = scan.scannedAt.toISOString();
      const terminal = scan.terminalMac
        ? await transaction.device.findFirst({
            where: { projectId, tipo: "TERMINAL", mac: scan.terminalMac },
            select: { id: true },
          })
        : null;
      const audit = currentAuditWrite();
      const detalle = {
        offline: true,
        escaneadoEn,
        gatewayId,
        ...(scan.terminalMac ? { terminalMac: scan.terminalMac } : {}),
      };
      const event = {
        terminalId: terminal?.id ?? null,
        actorId: audit.actorId,
        actorNombre: audit.actorNombre,
      };

      if (result === "ACEPTADO") {
        await transaction.ticket.update({
          where: { id: ticketId },
          data: { usadoEn: scan.scannedAt, history: { create: { tipo: "ACCESO_CONCEDIDO", detalle, ...event } } },
        });
        return { hash: scan.hash, resultado: result };
      }

      // Re-sending the same rejected scan must not add it twice.
      const repeated = await transaction.ticketEvent.findFirst({
        where: { ticketId, tipo: "ACCESO_RECHAZADO", detalle: { path: ["escaneadoEn"], equals: escaneadoEn } },
        select: { id: true },
      });
      if (!repeated) {
        await transaction.ticketEvent.create({
          data: { ticketId, tipo: "ACCESO_RECHAZADO", detalle: { ...detalle, motivo: REJECTION_REASON[result] }, ...event },
        });
      }
      return { hash: scan.hash, resultado: result };
    });
  }
}
