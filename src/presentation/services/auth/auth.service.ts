import crypto from "node:crypto";

import { resetPasswordEmailHtml, resetPasswordExpiredHtml, resetPasswordPageHtml } from "../../../config";
import { bcryptPlugin } from "../../../config/plugins/bcrypt.plugin";
import { JwtPlugin } from "../../../config/plugins/jwt.plugin";
import type { ForgotPasswordDto, LoginDto, ResetPasswordDto } from "../../../domain/dtos";
import { CustomError } from "../../../domain/errors/custom.error";
import type { UsuarioRepository } from "../../../domain/repositories/auth/usuario.repository";
import type { EmailService } from "../email/email.service";
import type { SessionResolver, SessionUsuario } from "./session.resolver";

const PASSWORD_RESET_WINDOW_MS = 30 * 60 * 1000;

const PASSWORD_RESET_RESPONSE_MESSAGE =
  "Si el correo existe y está habilitado, enviaremos un enlace para restablecer la contraseña.";

const hashToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

export interface SessionResult {
  token: string;
  usuario: SessionUsuario;
}

export class AuthService {
  constructor(
    private readonly usuarios: UsuarioRepository,
    private readonly sessions: SessionResolver,
    private readonly emailService: EmailService,
    private readonly webServiceUrl: string,
  ) {}

  async login({ correo, password }: LoginDto): Promise<SessionResult> {
    const usuario = await this.usuarios.findByCorreo(correo);
    if (!usuario || !bcryptPlugin.compare(password, usuario.password)) {
      throw CustomError.unauthorized("Credenciales incorrectas");
    }
    return this.openSession(usuario.id);
  }

  /** New token for a user that is already signed in (and still allowed in). */
  renew(userId: string): Promise<SessionResult> {
    return this.openSession(userId);
  }

  async forgotPassword({ correo }: ForgotPasswordDto): Promise<{ message: string }> {
    const usuario = await this.usuarios.findByCorreo(correo);
    // Same answer whether or not the account exists, so the endpoint cannot list users.
    if (!usuario || !usuario.estado) return { message: PASSWORD_RESET_RESPONSE_MESSAGE };

    const rawToken = crypto.randomBytes(32).toString("hex");
    await this.usuarios.savePasswordResetToken(
      usuario.id,
      hashToken(rawToken),
      new Date(Date.now() + PASSWORD_RESET_WINDOW_MS),
    );

    const link = `${this.baseUrl}/api/auth/reset-password/${rawToken}`;
    const isSent = await this.emailService.sendEmail({
      to: usuario.correo,
      subject: "Recuperación de contraseña",
      htmlBody: resetPasswordEmailHtml(link, usuario.correo, usuario.nombre),
    });
    if (!isSent) throw CustomError.serviceUnavailable("No se pudo enviar el correo");

    return { message: PASSWORD_RESET_RESPONSE_MESSAGE };
  }

  async resetPassword({ token, newPassword }: ResetPasswordDto): Promise<{ message: string }> {
    const usuario = await this.usuarios.findByPasswordResetToken(hashToken(token));
    if (!usuario) throw CustomError.unauthorized("El enlace de recuperación es inválido o expiró");

    await this.usuarios.resetPassword(usuario.id, bcryptPlugin.hash(newPassword));
    return { message: "Tu contraseña se actualizó correctamente. Ya puedes iniciar sesión." };
  }

  async getResetPasswordPage(token: string): Promise<{ statusCode: number; html: string }> {
    const usuario = token ? await this.usuarios.findByPasswordResetToken(hashToken(token)) : null;
    if (!usuario) return { statusCode: 400, html: resetPasswordExpiredHtml() };
    return {
      statusCode: 200,
      html: resetPasswordPageHtml(token, `${this.baseUrl}/api/auth/reset-password`),
    };
  }

  private get baseUrl() {
    return this.webServiceUrl.replace(/\/+$/, "");
  }

  private async openSession(userId: string): Promise<SessionResult> {
    const usuario = await this.usuarios.findById(userId);
    if (!usuario) throw CustomError.unauthorized("Usuario no encontrado");

    const session = await this.sessions.resolve(usuario);
    const token = await JwtPlugin.generateToken({ id: usuario.id });
    if (!token) throw CustomError.internalServer("No se pudo generar el token");

    return { token: String(token), usuario: session };
  }
}
