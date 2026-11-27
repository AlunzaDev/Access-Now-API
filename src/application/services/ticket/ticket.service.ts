import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { TicketListFilters } from "../../../domain/datasources/ticket/ticket.datasource";
import type {
  CreateTicketBatchDto,
  CreateTicketDto,
  UpdateTicketDto,
} from "../../../domain/dtos/ticket/ticket.dto";
import type { PageRequest } from "../../../domain/dtos/shared/pagination";
import { TicketEntity } from "../../../domain/entities/ticket/ticket.entity";
import { CustomError } from "../../../domain/errors/custom.error";
import { canCancelTicket, canChangeTicket } from "../../../domain/policies/ticket/ticket-policy";
import type { TicketRepository } from "../../../domain/repository/ticket/ticket.repository";

const encryptionKey = (seed: string) => createHash("sha256").update(`access-now-ticket-qr:${seed}`).digest();

const encryptToken = (token: string, seed: string) => {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(seed), iv);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return {
    tokenCiphertext: ciphertext.toString("base64url"),
    tokenIv: iv.toString("base64url"),
    tokenTag: cipher.getAuthTag().toString("base64url"),
  };
};

const decryptToken = (encrypted: { tokenCiphertext: string; tokenIv: string; tokenTag: string }, seed: string) => {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(seed),
    Buffer.from(encrypted.tokenIv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(encrypted.tokenTag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted.tokenCiphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
};

const newSecret = (seed: string) => {
  const token = `AN1.${randomBytes(32).toString("base64url")}`;
  return {
    token,
    tokenHash: createHash("sha256").update(token).digest("hex"),
    folio: `AN-${randomBytes(6).toString("hex").toUpperCase()}`,
    ...encryptToken(token, seed),
  };
};

const issued = (ticket: TicketEntity, token: string) => ({ ...ticket.toJSON(), token });
const TOKEN_FORMAT = /^AN1\.[A-Za-z0-9_-]{43}$/;

/** What a terminal needs to show; never the holder's contact data. */
const scanView = (ticket: TicketEntity) => ({
  id: ticket.id,
  folio: ticket.values.folio,
  eventoNombre: ticket.values.eventoNombre,
  titularNombre: ticket.values.titularNombre,
  estadoAcceso: ticket.values.estadoAcceso,
  usadoEn: ticket.values.usadoEn,
});

export type AccessAnswer = {
  acceso: "CONCEDIDO" | "RECHAZADO";
  message: string;
  boleto: ReturnType<typeof scanView> | null;
};

export class TicketService {
  constructor(private readonly tickets: TicketRepository, private readonly encryptionSeed: string) {}

  async create(projectId: string, dto: CreateTicketDto) {
    const secret = newSecret(this.encryptionSeed);
    const ticket = await this.tickets.create(projectId, dto.eventId, dto.values, secret);
    return issued(ticket, secret.token);
  }

  async createBatch(projectId: string, dto: CreateTicketBatchDto) {
    const secrets = Array.from({ length: dto.cantidad }, () => newSecret(this.encryptionSeed));
    const tickets = await this.tickets.createBatch(projectId, dto.eventId, secrets);
    return { items: tickets.map((ticket, index) => issued(ticket, secrets[index].token)), total: tickets.length };
  }

  list(filters: TicketListFilters, page: PageRequest) { return this.tickets.list(filters, page); }

  async getById(projectId: string, id: string) {
    const ticket = await this.tickets.findById(projectId, id);
    if (!ticket) throw CustomError.notFound("Boleto no encontrado");
    const history = await this.tickets.history(projectId, id);
    return new TicketEntity({ ...ticket.values, historial: history ?? [] });
  }

  async update(projectId: string, id: string, dto: UpdateTicketDto) {
    const current = await this.getById(projectId, id);
    const error = canChangeTicket(current.values, dto.values.estadoVenta);
    if (error) throw CustomError.conflict(error);
    const ticket = await this.tickets.update(projectId, id, dto.values);
    if (!ticket) throw CustomError.notFound("Boleto no encontrado");
    return ticket;
  }

  async cancel(projectId: string, id: string) {
    const current = await this.tickets.findById(projectId, id);
    if (!current) throw CustomError.notFound("Boleto no encontrado");
    const error = canCancelTicket(current.values);
    if (error) throw CustomError.conflict(error);
    const ticket = await this.tickets.cancel(projectId, id);
    if (!ticket) throw CustomError.notFound("Boleto no encontrado");
    return ticket;
  }

  async reissue(projectId: string, id: string) {
    const current = await this.getById(projectId, id);
    if (["CANCELADO", "REEMBOLSADO"].includes(current.values.estadoVenta) ||
        current.values.estadoAcceso === "USADO") {
      throw CustomError.conflict("No se puede reemitir el QR de un boleto anulado o utilizado");
    }
    const secret = newSecret(this.encryptionSeed);
    const ticket = await this.tickets.reissue(projectId, id, {
      tokenHash: secret.tokenHash,
      tokenCiphertext: secret.tokenCiphertext,
      tokenIv: secret.tokenIv,
      tokenTag: secret.tokenTag,
    });
    if (!ticket) throw CustomError.notFound("Boleto no encontrado");
    return issued(ticket, secret.token);
  }

  async getQr(projectId: string, id: string) {
    const ticket = await this.getById(projectId, id);
    if (["CANCELADO", "REEMBOLSADO"].includes(ticket.values.estadoVenta)) {
      throw CustomError.conflict("No se puede consultar el QR de un boleto anulado");
    }
    const encrypted = await this.tickets.getActiveCredential(projectId, id);
    if (!encrypted) {
      throw CustomError.conflict("Este boleto fue emitido antes del resguardo recuperable; reemite su QR");
    }
    return issued(ticket, decryptToken(encrypted, this.encryptionSeed));
  }

  /**
   * A scan from a gateway of the project. Always answers in the same shape: an unknown or
   * malformed QR is a rejection the terminal can show, not an error.
   */
  async validateAccess(
    projectId: string,
    token: string,
    origin: { gatewayId: string; terminalMac?: string },
  ): Promise<AccessAnswer> {
    if (!TOKEN_FORMAT.test(token)) return { acceso: "RECHAZADO", message: "QR no reconocido", boleto: null };
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const result = await this.tickets.validateAccess(projectId, tokenHash, origin);
    if (!result) return { acceso: "RECHAZADO", message: "Boleto no encontrado o cancelado", boleto: null };
    return {
      acceso: result.granted ? "CONCEDIDO" : "RECHAZADO",
      message: result.message,
      boleto: scanView(result.ticket),
    };
  }
}
