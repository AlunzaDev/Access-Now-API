// The printable ticket (PDF). The implementation (pdfkit) is in infrastructure/document.

/** Everything printed on one ticket; the QR is the plain token, encoded by the renderer. */
export type TicketDocument = {
  folio: string;
  token: string;
  titularNombre: string;
  titularCorreo: string;
  /** Who organizes it (the project). */
  organizador: string;
  eventoNombre: string;
  /** Already written for people, e.g. "Sábado 13 de marzo de 2026 · 20:00 a 23:00". */
  horario: string;
  lugar: string;
  direccion: string;
  /** Link to the map, when the project has a location. */
  mapaUrl: string | null;
  /** When the ticket was issued (sold or generated). */
  emitidoEn: Date;
};

export interface TicketDocumentRenderer {
  /** One ticket per page, in the given order. */
  render(tickets: TicketDocument[]): Promise<Buffer>;
}
