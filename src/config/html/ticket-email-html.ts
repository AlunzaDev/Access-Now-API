import { emailTheme, emailThemeStyles } from "./email-theme";

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

export type TicketEmailData = {
  titularNombre: string;
  eventoNombre: string;
  horario: string;
  lugar: string;
  folio: string;
  mapaUrl: string | null;
};

/** The email that carries a ticket. The QR travels in the attached PDF, not in the body. */
export const ticketEmailHtml = (data: TicketEmailData): string => {
  const name = escapeHtml(data.titularNombre.trim() || "Hola");
  const event = escapeHtml(data.eventoNombre);
  const schedule = escapeHtml(data.horario);
  const place = escapeHtml(data.lugar);
  const folio = escapeHtml(data.folio);
  const map = data.mapaUrl
    ? `<a class="email-link" href="${escapeHtml(data.mapaUrl)}" target="_blank" rel="noopener noreferrer" style="color:${emailTheme.brand.link};text-decoration:underline;">Ver en el mapa</a>`
    : "";

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="color-scheme" content="light dark" />
  <title>Tu boleto para ${event} - Access Now</title>
  <style>${emailThemeStyles}</style>
</head>
<body class="email-page" style="margin:0;padding:0;background-color:${emailTheme.light.page};color:${emailTheme.light.title};font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
    Tu boleto para ${event} va adjunto en PDF. Folio ${folio}.
  </div>
  <table class="email-page" role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background-color:${emailTheme.light.page};">
    <tr>
      <td align="center" style="padding:32px 12px;">
        <table class="email-card" role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;background-color:${emailTheme.light.card};border:1px solid ${emailTheme.light.border};border-radius:22px;">
          <tr>
            <td align="center" style="padding:32px 24px;background-color:${emailTheme.brand.header};border-radius:22px 22px 0 0;">
              <img src="cid:accessnow-logo" width="54" height="54" alt="Access Now" style="display:block;width:54px;height:54px;margin:0 auto 12px;border:0;object-fit:contain;" />
              <div style="font-size:28px;line-height:1;font-weight:800;letter-spacing:3px;color:#ffffff;">ACCESS NOW</div>
              <div style="margin-top:10px;font-size:14px;line-height:1.5;color:${emailTheme.brand.accentText};">Tu boleto electrónico</div>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 32px 32px;">
              <div style="font-size:12px;line-height:1.4;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#347b48;">Boleto</div>
              <h1 class="email-title" style="margin:10px 0 14px;font-size:28px;line-height:1.2;color:${emailTheme.light.title};">${event}</h1>
              <p class="email-body" style="margin:0 0 6px;font-size:16px;line-height:1.7;color:${emailTheme.light.body};">${schedule}</p>
              <p class="email-body" style="margin:0 0 18px;font-size:16px;line-height:1.7;color:${emailTheme.light.body};">${place} ${map}</p>
              <p class="email-body" style="margin:0 0 18px;font-size:16px;line-height:1.7;color:${emailTheme.light.body};">
                <strong class="email-strong" style="color:${emailTheme.light.title};">${name}</strong>, tu boleto va <strong class="email-strong" style="color:${emailTheme.light.title};">adjunto en PDF</strong>. Muéstralo en la entrada desde tu celular o impreso.
              </p>
              <div class="email-surface" style="padding:13px 14px;background-color:${emailTheme.light.surface};border:1px solid ${emailTheme.light.border};border-radius:10px;font-size:14px;line-height:1.6;color:${emailTheme.light.body};">
                Folio: <strong class="email-strong" style="font-family:'Courier New',monospace;color:${emailTheme.light.title};">${folio}</strong>
              </div>
              <div class="email-callout" style="margin:24px 0 0;padding:14px 16px;background-color:${emailTheme.light.callout};border-left:4px solid #3d9155;border-radius:8px;font-size:14px;line-height:1.6;color:${emailTheme.light.body};">
                <strong>¡No compartas tu código!</strong> Solo la primera persona que lo use entra.
              </div>
            </td>
          </tr>
        </table>
        <p class="email-muted" style="margin:18px 0 0;font-size:12px;line-height:1.5;color:${emailTheme.light.muted};">Mensaje automático de Access Now. No respondas a este correo.</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
};
