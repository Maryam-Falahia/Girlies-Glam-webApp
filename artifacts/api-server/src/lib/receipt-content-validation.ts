import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { ParsedReceipt } from "./receipt-validation";

const execFileAsync = promisify(execFile);
const OCR_TIMEOUT_MS = 15_000;
const MAX_EXTRACTED_TEXT = 512 * 1024;

const RECEIPT_TERMS =
  /\b(receipt|transfer|payment|transaction|bank|beneficiary|reference|ref(?:erence)?\.?|successful|completed|credited|debit(?:ed)?)\b|إيصال|تحويل|دفع|معاملة|مصرف|بنك|مرجع|المبلغ|نجاح|تمت/i;
const FINANCIAL_TERMS =
  /\b(?:omr|amount|total|fee|balance|currency|rial|riyals?)\b|ر\.?\s*ع|ريال|المبلغ|الإجمالي|الرصيد/i;
const AMOUNT_PATTERN = /(?:^|\s)[0-9٠-٩]{1,7}(?:[.,٫][0-9٠-٩]{1,3})?(?:\s|$)/;

export function receiptTextLooksLikePaymentReceipt(text: string): boolean {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return false;
  return RECEIPT_TERMS.test(normalized) && (FINANCIAL_TERMS.test(normalized) || AMOUNT_PATTERN.test(normalized));
}

async function extractReceiptText(receipt: ParsedReceipt): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "girlies-glam-receipt-"));
  const extension = receipt.mimeType === "application/pdf" ? "pdf" : "image";
  const filePath = join(directory, `receipt.${extension}`);

  try {
    await writeFile(filePath, receipt.bytes);
    const result =
      receipt.mimeType === "application/pdf"
        ? await execFileAsync("pdftotext", [filePath, "-"], { timeout: OCR_TIMEOUT_MS, maxBuffer: MAX_EXTRACTED_TEXT })
        : await execFileAsync("tesseract", [filePath, "stdout", "-l", "eng+ara", "--psm", "6"], {
            timeout: OCR_TIMEOUT_MS,
            maxBuffer: MAX_EXTRACTED_TEXT,
          });
    return result.stdout.slice(0, MAX_EXTRACTED_TEXT);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

export async function validateReceiptContent(
  receipt: ParsedReceipt,
): Promise<{ valid: true; text: string } | { valid: false; reason: "not_receipt" | "text_extraction_failed" }> {
  try {
    const text = await extractReceiptText(receipt);
    return receiptTextLooksLikePaymentReceipt(text)
      ? { valid: true, text }
      : { valid: false, reason: "not_receipt" };
  } catch {
    return { valid: false, reason: "text_extraction_failed" };
  }
}