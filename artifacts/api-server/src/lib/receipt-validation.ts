export const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;

const RECEIPT_DATA_URL =
  /^data:(application\/pdf|image\/jpeg|image\/png|image\/webp);base64,([A-Za-z0-9+/=\s]+)$/;

export type ReceiptMimeType = "application/pdf" | "image/jpeg" | "image/png" | "image/webp";
export type ParsedReceipt = { mimeType: ReceiptMimeType; base64: string; bytes: Buffer };

function startsWithBytes(value: Buffer, signature: string): boolean {
  return value.subarray(0, signature.length).equals(Buffer.from(signature, "ascii"));
}

function hasReceiptSignature(mimeType: ReceiptMimeType, value: Buffer): boolean {
  if (mimeType === "application/pdf") return startsWithBytes(value, "%PDF-");
  if (mimeType === "image/jpeg") return value.length >= 3 && value[0] === 0xff && value[1] === 0xd8 && value[2] === 0xff;
  if (mimeType === "image/png") return startsWithBytes(value, "\x89PNG\r\n\x1a\n");
  return value.length >= 12 && startsWithBytes(value, "RIFF") && value.subarray(8, 12).equals(Buffer.from("WEBP", "ascii"));
}

export function receiptExtension(mimeType: ReceiptMimeType): string {
  return mimeType === "application/pdf" ? "pdf" : mimeType.split("/")[1].replace("jpeg", "jpg");
}

export function parseReceiptDataUrl(value: string): ParsedReceipt | null {
  const match = RECEIPT_DATA_URL.exec(value);
  if (!match) return null;

  const base64 = match[2].replace(/\s/g, "");
  if (!base64 || base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) return null;

  const bytes = Buffer.from(base64, "base64");
  const mimeType = match[1] as ReceiptMimeType;
  if (bytes.length > MAX_RECEIPT_BYTES || !hasReceiptSignature(mimeType, bytes)) return null;

  return { mimeType, base64, bytes };
}