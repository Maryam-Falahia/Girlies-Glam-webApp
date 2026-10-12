import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = createHash("sha256").update(salt + password).digest("hex");
  return salt + ":" + hash;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, expected] = stored.split(":");
  if (!salt || !expected) return false;
  const actual = createHash("sha256").update(salt + password).digest("hex");
  return expected.length === actual.length && timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
}

export function getUserId(req: { signedCookies?: Record<string, unknown> }): number | null {
  const raw = req.signedCookies?.gg_session;
  const id = typeof raw === "string" ? Number(raw) : NaN;
  return Number.isInteger(id) && id > 0 ? id : null;
}
