import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { EncryptedTicketToken } from "../../../domain/datasources/ticket/ticket.datasource";

/**
 * The QR is stored twice: its SHA-256 (to validate scans) and encrypted with AES-256-GCM (to
 * show it again, only to an authorized user). Never in plain text.
 */
const encryptionKey = (seed: string) => createHash("sha256").update(`access-now-ticket-qr:${seed}`).digest();

export const encryptToken = (token: string, seed: string) => {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(seed), iv);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return {
    tokenCiphertext: ciphertext.toString("base64url"),
    tokenIv: iv.toString("base64url"),
    tokenTag: cipher.getAuthTag().toString("base64url"),
  };
};

export const decryptToken = (encrypted: EncryptedTicketToken, seed: string) => {
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

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
