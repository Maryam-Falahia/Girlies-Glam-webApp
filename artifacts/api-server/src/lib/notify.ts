import nodemailer from "nodemailer";
import { db, notificationSettingsTable } from "@workspace/db";
import type { ordersTable } from "@workspace/db";
import { logger } from "./logger";
import { buildOrderBillHtml, buildOrderBillText } from "./order-bill";
import { parseReceiptDataUrl, receiptExtension } from "./receipt-validation";
import { createReceiptDownloadUrl } from "./receipt-download";

async function getSettings() {
  const [existing] = await db.select().from(notificationSettingsTable);
  if (existing) return existing;
  const [created] = await db.insert(notificationSettingsTable).values({ id: 1 }).returning();
  return created;
}

function transferReceiptAttachment(value: string | null | undefined, orderRef: string) {
  if (!value) return null;
  const parsed = parseReceiptDataUrl(value);
  if (!parsed) return null;
  const extension = receiptExtension(parsed.mimeType);
  return {
    filename: `${orderRef}-transfer-receipt.${extension}`,
    content: Buffer.from(parsed.base64, "base64"),
    contentType: parsed.mimeType,
  };
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] || character);
}

async function sendEmail(
  to: string,
  subject: string,
  text: string,
  html: string,
  orderRef: string,
  transferReceipt?: string | null,
  receiptDownloadUrl?: string | null,
) {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    throw new Error("Email notification is not configured");
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT || 587),
    secure: Number(SMTP_PORT || 587) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  const attachments = [{
    filename: `${orderRef}-bill.html`,
    content: Buffer.from(html, "utf8"),
    contentType: "text/html; charset=utf-8",
  }];
  const receiptAttachment = transferReceiptAttachment(transferReceipt, orderRef);
  if (receiptAttachment) attachments.push(receiptAttachment);
  const receiptText = receiptDownloadUrl ? `\n\nPayment receipt download: ${receiptDownloadUrl}` : "";
  const receiptHtml = receiptDownloadUrl
    ? `<p>Payment receipt: <a href="${escapeHtml(receiptDownloadUrl)}">Download receipt</a></p>`
    : "";

  await transporter.sendMail({
    from: SMTP_FROM || SMTP_USER,
    to,
    subject,
    text: `${text}${receiptText}`,
    html: `${html}${receiptHtml}`,
    attachments,
  });
}

async function sendWhatsApp(to: string, body: string) {
  const apiKey = process.env.CALLMEBOT_API_KEY;
  if (!apiKey) {
    throw new Error("WhatsApp notification is not configured");
  }
  if (!to || !/^\+\d{6,15}$/.test(to)) {
    throw new Error(`Invalid WhatsApp phone number: ${to}`);
  }

  const params = new URLSearchParams({
    source: "GirliesGlam",
    phone: to,
    text: body,
    apikey: apiKey,
  });
  const response = await fetch(`https://api.callmebot.com/whatsapp.php?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`CallMeBot error ${response.status}: ${await response.text()}`);
  }
  const responseText = await response.text();
  if (/error|invalid|denied|fail/i.test(responseText)) {
    throw new Error(`CallMeBot rejected the message: ${responseText}`);
  }
}

export async function sendNotificationTest(channel: "email" | "whatsapp", recipient?: string) {
  const settings = await getSettings();
  const target = recipient || (channel === "email" ? settings.notifyEmail : settings.notifyPhone);
  const subject = "Girlies Glam notification test";
  const text = "This is a test notification from Girlies Glam. Your alert channel is configured correctly.";
  if (channel === "email") {
    await sendEmail(target, subject, text, `<p>${text}</p>`, "TEST", null, null);
  } else {
    await sendWhatsApp(target, text);
  }
  return { channel, recipient: target };
}

async function deliverChannel(
  channel: "email" | "whatsapp",
  deliver: () => Promise<void>,
) {
  const failureField = channel === "email" ? "emailFailureAt" : "whatsappFailureAt";
  try {
    await deliver();
    await db.update(notificationSettingsTable).set({ [failureField]: null });
  } catch (err) {
    await db.update(notificationSettingsTable).set({ [failureField]: new Date() });
    logger.error({ err }, `Failed to send order notification ${channel === "email" ? "email" : "WhatsApp"}`);
  }
}

export async function notifyNewOrder(order: typeof ordersTable.$inferSelect) {
  try {
    const settings = await getSettings();
    const billText = buildOrderBillText(order);
    const billHtml = buildOrderBillHtml(order);
    const receiptDownloadUrl = order.transferReceipt ? createReceiptDownloadUrl(order.orderRef) : null;
    const whatsappText = receiptDownloadUrl
      ? `${billText}\n\nPayment receipt download: ${receiptDownloadUrl}`
      : billText;

    await Promise.allSettled([
      deliverChannel("email", () =>
        sendEmail(
          settings.notifyEmail,
          `New order: ${order.orderRef}`,
          billText,
          billHtml,
          order.orderRef,
          order.transferReceipt,
          receiptDownloadUrl,
        ),
      ),
      deliverChannel("whatsapp", () => sendWhatsApp(settings.notifyPhone, whatsappText)),
    ]);
  } catch (err) {
    logger.error({ err }, "notifyNewOrder failed unexpectedly");
  }
}