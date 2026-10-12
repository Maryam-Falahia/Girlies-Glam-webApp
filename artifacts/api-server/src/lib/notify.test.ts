import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sendMail: vi.fn(),
  createTransport: vi.fn(),
  loggerError: vi.fn(),
  loggerWarn: vi.fn(),
  settings: {
    id: 1,
    notifyEmail: "orders@example.com",
    notifyPhone: "+96879162199",
    emailFailureAt: null as Date | null,
    whatsappFailureAt: null as Date | null,
  },
  updateSet: vi.fn(),
}));

vi.mock("nodemailer", () => ({
  default: {
    createTransport: mocks.createTransport,
  },
}));
vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(async () => [mocks.settings]),
    })),
    update: vi.fn(() => ({ set: mocks.updateSet })),
  },
  notificationSettingsTable: {},
  ordersTable: {},
}));
vi.mock("./logger", () => ({
  logger: {
    error: mocks.loggerError,
    warn: mocks.loggerWarn,
  },
}));

import { notifyNewOrder } from "./notify";

const order = {
  id: 10,
  orderRef: "GG-12345",
  userId: 7,
  status: "Submitted",
  total: 24.5,
  shippingName: "Aisha",
  shippingAddress: "Al Khuwair, Way 123",
  phone: "+968 79162199",
  governorate: "Muscat",
  city: "Muscat",
  postalCode: "100",
  paymentIntentId: "payment-1",
  transferReceipt: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  items: [],
  createdAt: new Date("2026-09-17T00:00:00Z"),
};

describe("notifyNewOrder", () => {
  beforeEach(() => {
    vi.stubEnv("SMTP_HOST", "smtp.example.com");
    vi.stubEnv("SMTP_PORT", "587");
    vi.stubEnv("SMTP_USER", "smtp-user");
    vi.stubEnv("SMTP_PASS", "smtp-pass");
    vi.stubEnv("SMTP_FROM", "shop@example.com");
    vi.stubEnv("CALLMEBOT_API_KEY", "test-key");
    vi.stubEnv("REPLIT_DOMAINS", "shop.example.com");
    mocks.sendMail.mockReset().mockResolvedValue(undefined);
    mocks.createTransport.mockReset().mockReturnValue({ sendMail: mocks.sendMail });
    mocks.loggerError.mockReset();
    mocks.loggerWarn.mockReset();
    mocks.updateSet.mockReset().mockResolvedValue(undefined);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue("Message queued"),
    }));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("loads configured contacts and attempts email and WhatsApp with order details", async () => {
    await expect(notifyNewOrder(order as never)).resolves.toBeUndefined();

    expect(mocks.sendMail).toHaveBeenCalledWith(expect.objectContaining({
      from: "shop@example.com",
      to: "orders@example.com",
      subject: "New order: GG-12345",
      text: expect.stringMatching(/GG-12345[\s\S]*Aisha[\s\S]*Muscat[\s\S]*\+968 79162199[\s\S]*OMR 24\.500[\s\S]*Payment receipt download: https:\/\/shop\.example\.com\/api\/orders\/GG-12345\/transfer-receipt\/download\?token=/),
      html: expect.stringContaining("Girlies Glam Order Bill"),
      attachments: expect.arrayContaining([
        expect.objectContaining({
          filename: "GG-12345-bill.html",
          contentType: "text/html; charset=utf-8",
        }),
        expect.objectContaining({
          filename: "GG-12345-transfer-receipt.png",
          contentType: "image/png",
        }),
      ]),
    }));
    expect(fetch).toHaveBeenCalledOnce();
    expect(mocks.updateSet).toHaveBeenCalledWith({ emailFailureAt: null });
    expect(mocks.updateSet).toHaveBeenCalledWith({ whatsappFailureAt: null });
    const whatsappUrl = new URL(vi.mocked(fetch).mock.calls[0][0] as string);
    expect(whatsappUrl.searchParams.get("phone")).toBe("+96879162199");
    expect(whatsappUrl.searchParams.get("text")).toContain("GG-12345");
    expect(whatsappUrl.searchParams.get("text")).toContain("Aisha");
    expect(whatsappUrl.searchParams.get("text")).toContain("Total: OMR 24.500");
    expect(whatsappUrl.searchParams.get("text")).toContain("https://shop.example.com/api/orders/GG-12345/transfer-receipt/download?token=");
  });

  it("logs an email failure and still attempts WhatsApp", async () => {
    const failure = new Error("SMTP unavailable");
    mocks.sendMail.mockRejectedValue(failure);

    await expect(notifyNewOrder(order as never)).resolves.toBeUndefined();

    expect(fetch).toHaveBeenCalledOnce();
    expect(mocks.loggerError).toHaveBeenCalledWith(
      { err: failure },
      "Failed to send order notification email",
    );
    expect(mocks.updateSet).toHaveBeenCalledWith({
      emailFailureAt: expect.any(Date),
    });
    expect(mocks.updateSet).toHaveBeenCalledWith({ whatsappFailureAt: null });
  });

  it("logs a WhatsApp failure and still attempts email", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: vi.fn().mockResolvedValue("Unavailable"),
    }));

    await expect(notifyNewOrder(order as never)).resolves.toBeUndefined();

    expect(mocks.sendMail).toHaveBeenCalledOnce();
    expect(mocks.loggerError).toHaveBeenCalledWith(
      { err: expect.objectContaining({ message: expect.stringContaining("CallMeBot error 503") }) },
      "Failed to send order notification WhatsApp",
    );
    expect(mocks.updateSet).toHaveBeenCalledWith({ emailFailureAt: null });
    expect(mocks.updateSet).toHaveBeenCalledWith({
      whatsappFailureAt: expect.any(Date),
    });
  });

  it("clears a persisted delivery warning after the same channel recovers", async () => {
    const failure = new Error("SMTP unavailable");
    mocks.sendMail.mockRejectedValueOnce(failure).mockResolvedValueOnce(undefined);

    await expect(notifyNewOrder(order as never)).resolves.toBeUndefined();
    expect(mocks.updateSet).toHaveBeenCalledWith({ emailFailureAt: expect.any(Date) });

    mocks.updateSet.mockClear();
    await expect(notifyNewOrder(order as never)).resolves.toBeUndefined();

    expect(mocks.updateSet).toHaveBeenCalledWith({ emailFailureAt: null });
    expect(mocks.updateSet).toHaveBeenCalledWith({ whatsappFailureAt: null });
  });
});