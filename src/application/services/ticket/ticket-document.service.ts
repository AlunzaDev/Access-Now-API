import { ticketEmailHtml } from "../../../config/html/ticket-email-html";
import type {
  TicketDeliveryRecord,
  TicketDocumentRow,
} from "../../../domain/datasources/ticket/ticket-delivery.datasource";
import { CustomError } from "../../../domain/errors/custom.error";
import {
  canEmailTicket,
  canPrintTicket,
  deliveryAddress,
  eventScheduleText,
  mapUrl,
} from "../../../domain/policies/ticket/ticket-delivery-policy";
import type { TicketDocument, TicketDocumentRenderer } from "../../../domain/ports/document/ticket-document.port";
import type { EmailSender } from "../../../domain/ports/email/email-sender.port";
import type { TicketDeliveryRepository } from "../../../domain/repository/ticket/ticket-delivery.repository";
import { decryptToken } from "./ticket-token-cipher";

/** Pages per PDF: a batch beyond this is downloaded in parts. */
export const MAX_TICKETS_PER_PDF = 200;
const SEND_FAILED = "No se pudo enviar el correo (servidor de correo sin configurar o rechazó el envío)";

/**
 * The printable ticket (preview, download) and its delivery by email. Both use the same PDF,
 * generated here so the QR only leaves the API inside the document, for an authorized user.
 */
export class TicketDocumentService {
  constructor(
    private readonly deliveries: TicketDeliveryRepository,
    private readonly renderer: TicketDocumentRenderer,
    private readonly mailer: EmailSender,
    private readonly encryptionSeed: string,
  ) {}

  async pdf(projectId: string, ids: string[]): Promise<{ pdf: Buffer; fileName: string }> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) throw CustomError.badRequest("Indica al menos un boleto");
    if (unique.length > MAX_TICKETS_PER_PDF) {
      throw CustomError.badRequest(`Un PDF admite máximo ${MAX_TICKETS_PER_PDF} boletos`);
    }
    const rows = await this.deliveries.findDocuments(projectId, unique);
    if (rows.length !== unique.length) throw CustomError.notFound("Boleto no encontrado");
    for (const row of rows) this.assertPrintable(row);

    const pdf = await this.renderer.render(rows.map((row) => this.document(row)));
    await this.deliveries.recordQrViewed(rows.map((row) => row.id));
    return { pdf, fileName: rows.length === 1 ? `boleto-${rows[0].folio}.pdf` : `boletos-${rows.length}.pdf` };
  }

  /** Emails the ticket's PDF to the address given or the holder's; every attempt is recorded. */
  async send(projectId: string, id: string, requestedEmail?: string): Promise<{ estadoEnvio: "ENVIADO"; enviadoA: string }> {
    const [row] = await this.deliveries.findDocuments(projectId, [id]);
    if (!row) throw CustomError.notFound("Boleto no encontrado");
    const notSendable = canEmailTicket(row.estadoVenta);
    if (notSendable) throw CustomError.conflict(notSendable);
    const address = deliveryAddress(requestedEmail, row.titularCorreo);
    if ("error" in address) throw CustomError.badRequest(address.error);
    this.assertPrintable(row);

    const document = this.document(row);
    const pdf = await this.renderer.render([document]);
    const ok = await this.mailer.send({
      to: address.correo,
      subject: `Tu boleto para ${row.event.nombre}`,
      htmlBody: ticketEmailHtml({
        titularNombre: row.titularNombre,
        eventoNombre: row.event.nombre,
        horario: document.horario,
        lugar: [document.lugar, document.direccion].filter(Boolean).join(" · "),
        folio: row.folio,
        mapaUrl: document.mapaUrl,
      }),
      attachments: [{ filename: `boleto-${row.folio}.pdf`, content: pdf, contentType: "application/pdf" }],
    });
    await this.deliveries.recordDelivery({
      ticketId: row.id,
      correo: address.correo,
      ok,
      error: ok ? "" : SEND_FAILED,
      saveAsHolder: ok && address.saveAsHolder,
    });
    if (!ok) throw CustomError.serviceUnavailable(`${SEND_FAILED}. El intento quedó registrado.`);
    return { estadoEnvio: "ENVIADO", enviadoA: address.correo };
  }

  async history(projectId: string, id: string): Promise<TicketDeliveryRecord[]> {
    const [row] = await this.deliveries.findDocuments(projectId, [id]);
    if (!row) throw CustomError.notFound("Boleto no encontrado");
    return this.deliveries.listDeliveries(row.id, 50);
  }

  private assertPrintable(row: TicketDocumentRow): void {
    const voided = canPrintTicket(row.estadoVenta);
    if (voided) throw CustomError.conflict(`${row.folio}: ${voided}`);
    if (!row.credential) {
      throw CustomError.conflict(`${row.folio}: fue emitido antes del resguardo del QR; reemite su QR una vez`);
    }
  }

  private document(row: TicketDocumentRow): TicketDocument {
    return {
      folio: row.folio,
      token: decryptToken(row.credential!, this.encryptionSeed),
      titularNombre: row.titularNombre,
      titularCorreo: row.titularCorreo,
      organizador: row.project.nombre,
      eventoNombre: row.event.nombre,
      horario: eventScheduleText(row.event),
      lugar: row.project.nombre,
      direccion: [row.project.direccion, row.project.ciudad].filter(Boolean).join(", "),
      mapaUrl: mapUrl(row.project.latitud, row.project.longitud),
      emitidoEn: row.creadoEn,
    };
  }
}
