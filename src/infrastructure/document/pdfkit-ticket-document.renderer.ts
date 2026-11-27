import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import type { TicketDocument, TicketDocumentRenderer } from "../../domain/ports/document/ticket-document.port";

/**
 * A classic e-ticket on a letter page: a stub with the QR and a body with the event details,
 * separated by cut lines, and the conditions below. Prints well and reads well on a phone.
 */
const PAGE = { width: 612, height: 792, margin: 36 } as const;
const WIDTH = PAGE.width - PAGE.margin * 2;
const STUB_WIDTH = 252;
const TICKET_TOP = 78;
const TICKET_HEIGHT = 300;
const COLOR = {
  brand: "#102019",
  accent: "#2f7d46",
  title: "#17201b",
  body: "#526158",
  muted: "#7d8a83",
  line: "#c9d4cd",
  field: "#f1f5f2",
} as const;

const DATE = new Intl.DateTimeFormat("es-MX", { dateStyle: "long", timeStyle: "short", timeZone: "America/Mexico_City" });

const CONDITIONS = [
  "ESTE BOLETO ES PERSONAL E INTRANSFERIBLE Y VÁLIDO PARA UNA SOLA ENTRADA.",
  "El código QR se invalida con el primer escaneo: quien lo presente primero es quien entra. No lo compartas ni lo publiques en redes sociales. Si el organizador reemite tu QR, este deja de funcionar y recibirás uno nuevo.",
  "La admisión queda sujeta a la revisión que el organizador disponga para prevenir el ingreso de armas, drogas, bebidas o cualquier objeto no autorizado. El organizador puede reservarse el derecho de admisión o retirar al portador cuando su conducta lo amerite, sin reembolso.",
  "Horarios, contenido, cambios, cancelaciones y reembolsos son responsabilidad del organizador del evento. Conserva este boleto durante toda tu estancia.",
];

const collect = (document: PDFKit.PDFDocument): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    document.on("data", (chunk: Buffer) => chunks.push(chunk));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);
  });

const dashed = (document: PDFKit.PDFDocument, x1: number, y1: number, x2: number, y2: number) =>
  document.save().moveTo(x1, y1).lineTo(x2, y2).lineWidth(1).dash(4, { space: 4 }).strokeColor(COLOR.line).stroke().undash().restore();

/** A small label over a value, like the fields of a printed ticket. */
const field = (
  document: PDFKit.PDFDocument,
  { x, y, width, label, value, mono = false }: { x: number; y: number; width: number; label: string; value: string; mono?: boolean },
): number => {
  document.font("Helvetica-Bold").fontSize(8).fillColor(COLOR.muted).text(label, x, y, { width });
  const boxY = document.y + 3;
  const text = value || "—";
  document.font(mono ? "Courier-Bold" : "Helvetica").fontSize(mono ? 11 : 10);
  const height = document.heightOfString(text, { width: width - 16 }) + 10;
  document.roundedRect(x, boxY, width, height, 4).fill(COLOR.field);
  document.fillColor(COLOR.title).text(text, x + 8, boxY + 5, { width: width - 16 });
  return boxY + height + 8;
};

function brand(document: PDFKit.PDFDocument, ticket: TicketDocument): void {
  const { margin } = PAGE;
  document.font("Helvetica-Bold").fontSize(20).fillColor(COLOR.brand).text("ACCESS NOW", margin, margin, { characterSpacing: 2 });
  const after = margin + document.widthOfString("ACCESS NOW", { characterSpacing: 2 }) + 10;
  document.moveTo(after, margin + 2).lineTo(after, margin + 20).lineWidth(2).strokeColor(COLOR.accent).stroke();
  document.font("Helvetica").fontSize(9).fillColor(COLOR.muted).text("Boleto electrónico", after + 8, margin + 7);
  document.font("Helvetica").fontSize(9).fillColor(COLOR.body)
    .text(`Organiza: ${ticket.organizador}`, margin, margin + 7, { width: WIDTH, align: "right" });
}

async function stub(document: PDFKit.PDFDocument, ticket: TicketDocument): Promise<void> {
  const x = PAGE.margin + 16;
  const width = STUB_WIDTH - 32;
  let y = TICKET_TOP + 16;
  document.font("Helvetica-Bold").fontSize(13).fillColor(COLOR.title).text(ticket.eventoNombre, x, y, { width });
  document.font("Helvetica").fontSize(8.5).fillColor(COLOR.muted).text(`${ticket.lugar} / ${ticket.horario}`, x, document.y + 2, { width });
  y = document.y + 12;

  // Large enough (about 4.6 cm) for turnstile readers, with its quiet zone.
  const qrSize = 130;
  const qr = await QRCode.toBuffer(ticket.token, { errorCorrectionLevel: "M", margin: 2, width: 520 });
  document.image(qr, x - 6, y, { width: qrSize, height: qrSize });
  const side = x + qrSize + 2;
  const sideWidth = width - qrSize - 2;
  document.font("Helvetica-Bold").fontSize(9).fillColor(COLOR.title).text("Folio:", side, y + 14, { width: sideWidth });
  document.font("Courier-Bold").fontSize(9).text(ticket.folio, side, document.y + 2, { width: sideWidth });
  document.font("Helvetica-Bold").fontSize(9).fillColor(COLOR.accent).text("¡NO COMPARTAS TU CÓDIGO!", side, document.y + 12, { width: sideWidth });
  y += qrSize + 6;

  for (const [label, value] of [
    ["Titular", ticket.titularNombre || "Sin asignar"],
    ["Correo", ticket.titularCorreo || "—"],
    ["Emitido", DATE.format(ticket.emitidoEn)],
  ] as const) {
    document.font("Helvetica-Bold").fontSize(8).fillColor(COLOR.muted).text(label, x, y, { width });
    document.font("Helvetica").fontSize(9.5).fillColor(COLOR.title).text(value, x, document.y + 1, { width });
    y = document.y + 6;
  }
}

function body(document: PDFKit.PDFDocument, ticket: TicketDocument): void {
  const x = PAGE.margin + STUB_WIDTH + 18;
  const width = WIDTH - STUB_WIDTH - 34;
  let y = TICKET_TOP + 16;
  document.font("Helvetica-Bold").fontSize(10).fillColor(COLOR.title).text("BOLETO ELECTRÓNICO", x, y, { continued: true })
    .font("Helvetica").fillColor(COLOR.muted).text(" / Personal e intransferible.");
  y = document.y + 12;
  document.font("Helvetica-Bold").fontSize(15).fillColor(COLOR.title).text(ticket.eventoNombre, x, y, { width });
  document.font("Helvetica").fontSize(10.5).fillColor(COLOR.body).text(ticket.horario, x, document.y + 6, { width });
  document.text([ticket.lugar, ticket.direccion].filter(Boolean).join(" · "), x, document.y + 3, { width });
  if (ticket.mapaUrl) {
    document.fontSize(9).fillColor(COLOR.accent).text("Ver ubicación en el mapa", x, document.y + 3, { link: ticket.mapaUrl, underline: true });
  }
  y = document.y + 14;

  const half = (width - 10) / 2;
  const left = field(document, { x, y, width: half, label: "Folio", value: ticket.folio, mono: true });
  const right = field(document, { x: x + half + 10, y, width: half, label: "Organiza", value: ticket.organizador });
  field(document, { x, y: Math.max(left, right), width, label: "Titular", value: ticket.titularNombre || "Sin asignar" });
}

function conditions(document: PDFKit.PDFDocument): void {
  const { margin } = PAGE;
  let y = TICKET_TOP + TICKET_HEIGHT + 28;
  for (const paragraph of CONDITIONS) {
    const strong = paragraph === CONDITIONS[0];
    document.font(strong ? "Helvetica-Bold" : "Helvetica").fontSize(8.5).fillColor(strong ? COLOR.title : COLOR.body)
      .text(paragraph, margin, y, { width: WIDTH, align: "justify", lineGap: 1.5 });
    y = document.y + 8;
  }
  const footerY = PAGE.height - margin - 14;
  document.moveTo(margin, footerY - 10).lineTo(margin + WIDTH, footerY - 10).lineWidth(1).strokeColor(COLOR.line).stroke();
  document.font("Helvetica").fontSize(8).fillColor(COLOR.muted)
    .text("Generado por Access Now. Presenta este boleto impreso o desde tu celular con el brillo alto.", margin, footerY, {
      width: WIDTH - 120,
    });
  document.font("Helvetica-Bold").fontSize(10).fillColor(COLOR.brand)
    .text("ACCESS NOW", margin + WIDTH - 110, footerY - 1, { width: 110, align: "right", characterSpacing: 2, lineBreak: false });
}

async function page(document: PDFKit.PDFDocument, ticket: TicketDocument): Promise<void> {
  brand(document, ticket);
  const { margin } = PAGE;
  // The ticket: stub and body, framed by cut lines.
  dashed(document, margin, TICKET_TOP, margin + WIDTH, TICKET_TOP);
  dashed(document, margin, TICKET_TOP + TICKET_HEIGHT, margin + WIDTH, TICKET_TOP + TICKET_HEIGHT);
  dashed(document, margin + STUB_WIDTH, TICKET_TOP, margin + STUB_WIDTH, TICKET_TOP + TICKET_HEIGHT);
  await stub(document, ticket);
  body(document, ticket);
  conditions(document);
}

/** pdfkit: Helvetica covers Spanish (accents, ñ, ¡ ¿) without embedding fonts. */
export class PdfkitTicketDocumentRenderer implements TicketDocumentRenderer {
  async render(tickets: TicketDocument[]): Promise<Buffer> {
    const document = new PDFDocument({
      size: "LETTER",
      margin: PAGE.margin,
      autoFirstPage: false,
      info: { Title: tickets.length === 1 ? `Boleto ${tickets[0].folio}` : `${tickets.length} boletos`, Author: "Access Now" },
    });
    const done = collect(document);
    for (const ticket of tickets) {
      document.addPage();
      await page(document, ticket);
    }
    document.end();
    return done;
  }
}
