import jwt from "jsonwebtoken";
import { envs } from "./envs.plugin";

const SESSION_TOKEN_DURATION_SECONDS = 60 * 60 * 24 * 2;

export type TokenPayload = Record<string, unknown>;

export class JwtPlugin {
  static generateToken(payload: TokenPayload, duration: number = SESSION_TOKEN_DURATION_SECONDS): Promise<string | null> {
    return new Promise((resolve) => {
      jwt.sign(payload, envs.JWT_SEED, { expiresIn: duration }, (err, token) => resolve(err || !token ? null : token));
    });
  }

  /** The payload of a valid token, or null (expired, tampered or not a JWT). */
  static validateToken(token: string): Promise<TokenPayload | null> {
    return new Promise((resolve) => {
      jwt.verify(token, envs.JWT_SEED, (err, decoded) =>
        resolve(err || !decoded || typeof decoded !== "object" ? null : (decoded as TokenPayload)),
      );
    });
  }
}
