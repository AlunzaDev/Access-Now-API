import type { OfflineScan } from "../../datasources/ticket/ticket-catalog.datasource";
import { normalizeMac } from "../../policies/device/device-policy";

const MAX_SCANS = 500;
const HASH = /^[0-9a-f]{64}$/;
const SCAN_FIELDS = new Set(["hash", "escaneadoEn", "terminalMac"]);

/**
 * Body of POST /api/v1/tickets/escaneos-offline: scans the gateway accepted without internet.
 * A clock a little ahead is clamped to "now" (a scan cannot happen in the future).
 */
export class OfflineScansDto {
  private constructor(public readonly scans: OfflineScan[]) {}

  static create(body: Record<string, unknown>, nowMs = Date.now()): [string?, OfflineScansDto?] {
    const extra = Object.keys(body).filter((key) => key !== "escaneos");
    if (extra.length > 0) return [`Campos no permitidos: ${extra.join(", ")}`];
    if (!Array.isArray(body.escaneos) || body.escaneos.length === 0) return ["'escaneos' debe ser un arreglo con datos"];
    if (body.escaneos.length > MAX_SCANS) return [`'escaneos' admite máximo ${MAX_SCANS} elementos`];

    const scans: OfflineScan[] = [];
    for (const [index, item] of (body.escaneos as unknown[]).entries()) {
      const at = `'escaneos[${index}]'`;
      if (typeof item !== "object" || item === null || Array.isArray(item)) return [`${at} debe ser un objeto`];
      const scan = item as Record<string, unknown>;
      const unknown = Object.keys(scan).filter((key) => !SCAN_FIELDS.has(key));
      if (unknown.length > 0) return [`${at}: campos no permitidos: ${unknown.join(", ")}`];
      if (typeof scan.hash !== "string" || !HASH.test(scan.hash)) return [`${at}.hash debe ser el SHA-256 del QR`];
      const scannedAt = typeof scan.escaneadoEn === "string" || typeof scan.escaneadoEn === "number"
        ? new Date(scan.escaneadoEn)
        : null;
      if (!scannedAt || Number.isNaN(scannedAt.getTime())) return [`${at}.escaneadoEn debe ser una fecha (ISO o milisegundos)`];
      let terminalMac: string | undefined;
      if (scan.terminalMac !== undefined) {
        terminalMac = normalizeMac(scan.terminalMac) ?? undefined;
        if (!terminalMac) return [`${at}.terminalMac debe tener el formato AA:BB:CC:DD:EE:FF`];
      }
      scans.push({
        hash: scan.hash,
        scannedAt: scannedAt.getTime() > nowMs ? new Date(nowMs) : scannedAt,
        ...(terminalMac ? { terminalMac } : {}),
      });
    }
    return [undefined, new OfflineScansDto(scans)];
  }
}
