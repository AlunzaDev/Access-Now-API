import { currentAuditWrite } from "../../../config/audit-context";
import type {
  DeliveryAttempt,
  TicketDeliveryDatasource,
  TicketDeliveryRecord,
  TicketDocumentRow,
} from "../../../domain/datasources/ticket/ticket-delivery.datasource";
import { PostgresDatabase } from "../../prisma/postgres.database";
import { isUuid } from "../../prisma/prisma-errors";

const dateText = (value: Date) => value.toISOString().slice(0, 10);

export class TicketDeliveryPostgresDatasource implements TicketDeliveryDatasource {
  private get client() {
    return PostgresDatabase.client;
  }

  async findDocuments(projectId: string, ids: string[]): Promise<TicketDocumentRow[]> {
    const valid = ids.filter(isUuid);
    if (valid.length === 0) return [];
    const rows = await this.client.ticket.findMany({
      where: { projectId, id: { in: valid } },
      select: {
        id: true,
        folio: true,
        titularNombre: true,
        titularCorreo: true,
        estadoVenta: true,
        createdAt: true,
        credentials: {
          where: { revocadoEn: null },
          orderBy: { emitidoEn: "desc" },
          take: 1,
          select: { tokenCiphertext: true, tokenIv: true, tokenTag: true },
        },
        event: {
          select: { nombre: true, fechaInicio: true, fechaFin: true, horaInicio: true, horaFin: true },
        },
        project: {
          select: { nombre: true, direccion: true, ciudad: true, latitud: true, longitud: true },
        },
      },
    });
    const byId = new Map<string, TicketDocumentRow>();
    for (const { credentials, event, createdAt, ...row } of rows) {
      const credential = credentials[0];
      byId.set(row.id, {
        ...row,
        creadoEn: createdAt,
        credential:
          credential?.tokenCiphertext && credential.tokenIv && credential.tokenTag
            ? { tokenCiphertext: credential.tokenCiphertext, tokenIv: credential.tokenIv, tokenTag: credential.tokenTag }
            : null,
        event: { ...event, fechaInicio: dateText(event.fechaInicio), fechaFin: dateText(event.fechaFin) },
      });
    }
    return valid.flatMap((id) => byId.get(id) ?? []);
  }

  async recordQrViewed(ticketIds: string[]): Promise<void> {
    if (ticketIds.length === 0) return;
    const audit = currentAuditWrite();
    await this.client.ticketEvent.createMany({
      data: ticketIds.map((ticketId) => ({
        ticketId,
        tipo: "QR_CONSULTADO" as const,
        detalle: { medio: "PDF" },
        actorId: audit.actorId,
        actorNombre: audit.actorNombre,
      })),
    });
  }

  async recordDelivery({ ticketId, correo, ok, error, saveAsHolder }: DeliveryAttempt): Promise<void> {
    const audit = currentAuditWrite();
    const actor = { actorId: audit.actorId, actorNombre: audit.actorNombre };
    await this.client.$transaction([
      this.client.ticketDelivery.create({
        data: { ticketId, correo, estado: ok ? "ENVIADO" : "ERROR", error, ...actor },
      }),
      this.client.ticket.update({
        where: { id: ticketId },
        data: {
          ...(ok ? { estadoEnvio: "ENVIADO", enviadoEn: new Date(), enviadoA: correo } : {}),
          ...(saveAsHolder ? { titularCorreo: correo } : {}),
          history: {
            create: { tipo: ok ? "ENVIADO" : "ENVIO_FALLIDO", detalle: { correo, ...(error ? { error } : {}) }, ...actor },
          },
        },
      }),
      // A failed resend does not erase that the ticket was already delivered before.
      ...(ok
        ? []
        : [
            this.client.ticket.updateMany({
              where: { id: ticketId, estadoEnvio: "NO_ENVIADO" },
              data: { estadoEnvio: "ERROR" },
            }),
          ]),
    ]);
  }

  async listDeliveries(ticketId: string, limit: number): Promise<TicketDeliveryRecord[]> {
    const rows = await this.client.ticketDelivery.findMany({
      where: { ticketId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return rows.map((row) => ({
      id: row.id,
      correo: row.correo,
      estado: row.estado === "ENVIADO" ? "ENVIADO" : "ERROR",
      error: row.error,
      creadoEn: row.createdAt.getTime(),
      actor: { id: row.actorId, nombre: row.actorNombre },
    }));
  }
}
