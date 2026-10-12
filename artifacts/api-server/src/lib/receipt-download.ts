import { createHmac, timingSafeEqual } from "node:crypto";

const DOWNLOAD_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DEV_SIGNING_SECRET = "girlies-glam-dev-secret";

function signingSecret(): string {
  return process.env.SESSION_SECRET || DEV_SIGNING_SECRET;
}

function signature(payload: string): string {
  return createHmac("sha256", signingSecret()).update(payload).digest("base64url");
}

export function createReceiptDownloadToken(orderRef: string, now = Date.now()): string {
  const expiresAt = Math.floor((now + DOWNLOAD_TTL_MS) / 1000);
  const payload = `${orderRef}.${expiresAt}`;
  return `${expiresAt}.${signature(payload)}`;
}

export function verifyReceiptDownloadToken(orderRef: string, token: string, now = Date.now()): boolean {
  const separator = token.indexOf(".");
  if (separator <= 0) return false;

  const expiresAt = Number(token.slice(0, separator));
  if (!Number.isInteger(expiresAt) || expiresAt < Math.floor(now / 1000)) return false;

  const provided = token.slice(separator + 1);
  const expected = signature(`${orderRef}.${expiresAt}`);
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  return providedBuffer.length === expectedBuffer.length && timingSafeEqual(providedBuffer, expectedBuffer);
}

function publicBaseUrl(): string | null {
  const configured = process.env.REPLIT_APP_URL || process.env.APP_BASE_URL;
  if (configured) return configured.replace(/\/+$/, "");

  const domain = process.env.REPLIT_DOMAINS?.split(",")[0]?.trim();
  if (!domain) return null;
  return `${domain.startsWith("http://") || domain.startsWith("https://") ? domain : `https://${domain}`}`.replace(/\/+$/, "");
}

export function createReceiptDownloadUrl(orderRef: string): string | null {
  const baseUrl = publicBaseUrl();
  if (!baseUrl) return null;
  const token = createReceiptDownloadToken(orderRef);
  return `${baseUrl}/api/orders/${encodeURIComponent(orderRef)}/transfer-receipt/download?token=${encodeURIComponent(token)}`;
}