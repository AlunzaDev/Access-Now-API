import crypto from "node:crypto";

import { resetPasswordEmailHtml, resetPasswordExpiredHtml, resetPasswordPageHtml } from "../../../config";
import { bcryptPlugin } from "../../../config/plugins/bcrypt.plugin";
import { JwtPlugin } from "../../../config/plugins/jwt.plugin";
import type { ForgotPasswordDto, LoginDto, ResetPasswordDto } from "../../../domain/dtos";
import { CustomError } from "../../../domain/errors/custom.error";
import type { EmailSender } from "../../../domain/ports/email-sender.port";
import type { UserRepository } from "../../../domain/repository/user.repository";
import type { SessionService, SessionUser } from "./session.service";

const PASSWORD_RESET_WINDOW_MS = 30 * 60 * 1000;

const PASSWORD_RESET_RESPONSE_MESSAGE =
  "Si el correo existe y está habilitado, enviaremos un enlace para restablecer la contraseña.";

const hashToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

export interface SessionResult {
  token: string;
  usuario: SessionUser;
}

export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly sessions: SessionService,
    private readonly email: EmailSender,
    private readonly webServiceUrl: string,
  ) {}

  async login({ correo, password }: LoginDto): Promise<SessionResult> {
    const user = await this.users.findByEmail(correo);
    if (!user || !bcryptPlugin.compare(password, user.password)) {
      throw CustomError.unauthorized("Credenciales incorrectas");
    }
    return this.openSession(await this.sessions.forUser(user));
  }

  /** New token for a user that is already signed in (and still allowed in). */
  async renew(userId: string): Promise<SessionResult> {
    return this.openSession(await this.sessions.forUserId(userId));
  }

  async forgotPassword({ correo }: ForgotPasswordDto): Promise<{ message: string }> {
    const user = await this.users.findByEmail(correo);
    // Same answer whether or not the account exists, so the endpoint cannot list users.
    if (!user || !user.estado) return { message: PASSWORD_RESET_RESPONSE_MESSAGE };

    const rawToken = crypto.randomBytes(32).toString("hex");
    await this.users.savePasswordResetToken(
      user.id,
      hashToken(rawToken),
      new Date(Date.now() + PASSWORD_RESET_WINDOW_MS),
    );

    const sent = await this.email.send({
      to: user.correo,
      subject: "Recuperación de contraseña",
      htmlBody: resetPasswordEmailHtml(`${this.baseUrl}/api/auth/reset-password/${rawToken}`, user.correo, user.nombre),
    });
    if (!sent) throw CustomError.serviceUnavailable("No se pudo enviar el correo");

    return { message: PASSWORD_RESET_RESPONSE_MESSAGE };
  }

  async resetPassword({ token, newPassword }: ResetPasswordDto): Promise<{ message: string }> {
    const user = await this.users.findByPasswordResetToken(hashToken(token));
    if (!user) throw CustomError.unauthorized("El enlace de recuperación es inválido o expiró");

    await this.users.resetPassword(user.id, bcryptPlugin.hash(newPassword));
    return { message: "Tu contraseña se actualizó correctamente. Ya puedes iniciar sesión." };
  }

  async getResetPasswordPage(token: string): Promise<{ statusCode: number; html: string }> {
    const user = token ? await this.users.findByPasswordResetToken(hashToken(token)) : null;
    if (!user) return { statusCode: 400, html: resetPasswordExpiredHtml() };
    return { statusCode: 200, html: resetPasswordPageHtml(token, `${this.baseUrl}/api/auth/reset-password`) };
  }

  private get baseUrl() {
    return this.webServiceUrl.replace(/\/+$/, "");
  }

  private async openSession(usuario: SessionUser): Promise<SessionResult> {
    const token = await JwtPlugin.generateToken({ id: usuario.id });
    if (!token) throw CustomError.internalServer("No se pudo generar el token");
    return { token, usuario };
  }
}
