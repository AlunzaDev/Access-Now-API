// Outgoing email. The implementation (SMTP with nodemailer) is in infrastructure/email.

export interface EmailMessage {
  to: string | string[];
  subject: string;
  htmlBody: string;
}

export interface EmailSender {
  /** false when the message could not be sent (SMTP not configured or rejected). */
  send(message: EmailMessage): Promise<boolean>;
}
