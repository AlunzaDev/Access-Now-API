import nodemailer from "nodemailer";
import { existsSync } from "node:fs";
import path from "node:path";
import { envs } from "../../config";
import type { EmailMessage, EmailSender } from "../../domain/ports/email-sender.port";
import { logger } from "../../config/logger";

const LOGO_PATH = path.resolve(process.cwd(), "public", "email", "accessnow-icon.png");

/** SMTP with nodemailer. Without MAILER_HOST/EMAIL/SECRET_KEY it sends nothing and says so. */
export class NodemailerEmailSender implements EmailSender {
  private readonly transporter =
    envs.MAILER_HOST && envs.MAILER_EMAIL && envs.MAILER_SECRET_KEY
      ? nodemailer.createTransport({
          host: envs.MAILER_HOST,
          port: envs.MAILER_PORT,
          secure: envs.MAILER_SECURE,
          auth: { user: envs.MAILER_EMAIL, pass: envs.MAILER_SECRET_KEY },
        })
      : null;

  async send({ to, subject, htmlBody }: EmailMessage): Promise<boolean> {
    if (!this.transporter) {
      logger.warn("Correo no enviado: falta configurar MAILER_HOST, MAILER_EMAIL y MAILER_SECRET_KEY.");
      return false;
    }

    try {
      await this.transporter.sendMail({
        from: envs.MAILER_FROM_NAME ? `"${envs.MAILER_FROM_NAME}" <${envs.MAILER_EMAIL}>` : envs.MAILER_EMAIL,
        to,
        subject,
        html: htmlBody,
        attachments: existsSync(LOGO_PATH)
          ? [{ filename: "accessnow-icon.png", path: LOGO_PATH, cid: "accessnow-logo" }]
          : [],
      });
      return true;
    } catch (error) {
      logger.error("Error al enviar correo", error);
      return false;
    }
  }
}
