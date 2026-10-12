import { Router, type IRouter } from "express";
import { db, notificationSettingsTable, ordersTable, productsTable, shippingRatesTable, shippingSettingsTable } from "@workspace/db";
import { asc, desc, eq } from "drizzle-orm";
import { requireAdmin } from "../middlewares/auth";
import { quoteShipping, SAFE_DEFAULT_SHIPPING, getShippingPolicy } from "../lib/shipping";
import { sendNotificationTest } from "../lib/notify";

const router: IRouter = Router();

async function getOrCreateSettings() {
  const [existing] = await db.select().from(notificationSettingsTable);
  if (existing) return existing;
  const [created] = await db.insert(notificationSettingsTable).values({ id: 1 }).returning();
  return created;
}

function publicSettings(settings: typeof notificationSettingsTable.$inferSelect) {
  return {
    notifyEmail: settings.notifyEmail,
    notifyPhone: settings.notifyPhone,
    transferDetails: settings.transferDetails,
    deliveryHealth: {
      emailFailedAt: settings.emailFailureAt?.toISOString() ?? null,
      whatsappFailedAt: settings.whatsappFailureAt?.toISOString() ?? null,
    },
  };
}

router.get("/admin/settings", requireAdmin, async (_req, res): Promise<void> => {
  const settings = await getOrCreateSettings();
  res.json(publicSettings(settings));
});

router.get("/settings/payment", async (_req, res): Promise<void> => {
  const settings = await getOrCreateSettings();
  res.json({ transferDetails: settings.transferDetails });
});

router.get("/settings/shipping", async (_req, res): Promise<void> => {
  const policy = await getShippingPolicy();
  res.json(policy);
});

router.post("/settings/shipping/quote", async (req, res): Promise<void> => {
  const { governorate, wilayat, subtotal } = (req.body as any) || {};
  if (typeof governorate !== "string" || !governorate.trim() || typeof wilayat !== "string" || !wilayat.trim()) {
    res.status(400).json({ error: "governorate and wilayat are required" });
    return;
  }
  if (subtotal !== undefined && (typeof subtotal !== "number" || !Number.isFinite(subtotal) || subtotal < 0)) {
    res.status(400).json({ error: "subtotal must be a non-negative number" });
    return;
  }
  res.json(await quoteShipping(governorate, wilayat, subtotal ?? 0));
});

router.get("/admin/settings/shipping", requireAdmin, async (_req, res): Promise<void> => {
  res.json(await getShippingPolicy());
});

router.patch("/admin/settings/shipping", requireAdmin, async (req, res): Promise<void> => {
  const body = (req.body as any) || {};
  const defaultFee = body.defaultFee ?? SAFE_DEFAULT_SHIPPING.fee;
  const defaultEtaMinDays = body.defaultEtaMinDays ?? SAFE_DEFAULT_SHIPPING.etaMinDays;
  const defaultEtaMaxDays = body.defaultEtaMaxDays ?? SAFE_DEFAULT_SHIPPING.etaMaxDays;
  if (![defaultFee, defaultEtaMinDays, defaultEtaMaxDays].every((value) => typeof value === "number" && Number.isFinite(value) && value >= 0)) {
    res.status(400).json({ error: "Shipping fee and ETA values must be non-negative numbers" });
    return;
  }
  if (defaultEtaMaxDays < defaultEtaMinDays) {
    res.status(400).json({ error: "defaultEtaMaxDays must be greater than or equal to defaultEtaMinDays" });
    return;
  }
  const threshold = body.freeShippingThreshold;
  if (threshold !== null && threshold !== undefined && (typeof threshold !== "number" || !Number.isFinite(threshold) || threshold < 0)) {
    res.status(400).json({ error: "freeShippingThreshold must be null or a non-negative number" });
    return;
  }
  const rates = body.rates ?? [];
  if (!Array.isArray(rates)) {
    res.status(400).json({ error: "rates must be an array" });
    return;
  }
  for (const rate of rates) {
    if (
      !rate || typeof rate.governorate !== "string" || !rate.governorate.trim() ||
      (rate.wilayat !== undefined && rate.wilayat !== null && typeof rate.wilayat !== "string") ||
      typeof rate.fee !== "number" || !Number.isFinite(rate.fee) || rate.fee < 0 ||
      typeof rate.etaMinDays !== "number" || typeof rate.etaMaxDays !== "number" ||
      rate.etaMinDays < 0 || rate.etaMaxDays < rate.etaMinDays
    ) {
      res.status(400).json({ error: "Each shipping rate must include valid governorate, fee, and ETA values" });
      return;
    }
  }
  await db.delete(shippingRatesTable);
  if (rates.length) {
    await db.insert(shippingRatesTable).values(rates.map((rate: any) => ({
      governorate: rate.governorate.trim(),
      wilayat: typeof rate.wilayat === "string" && rate.wilayat.trim() ? rate.wilayat.trim() : null,
      fee: rate.fee,
      etaMinDays: rate.etaMinDays,
      etaMaxDays: rate.etaMaxDays,
      isActive: rate.isActive !== false,
    })));
  }
  await db
    .insert(shippingSettingsTable)
    .values({ id: 1, defaultFee, defaultEtaMinDays, defaultEtaMaxDays, freeShippingThreshold: threshold ?? null })
    .onConflictDoUpdate({
      target: shippingSettingsTable.id,
      set: { defaultFee, defaultEtaMinDays, defaultEtaMaxDays, freeShippingThreshold: threshold ?? null, updatedAt: new Date() },
    });
  res.json(await getShippingPolicy());
});

router.post("/admin/settings/notifications/test", requireAdmin, async (req, res): Promise<void> => {
  const { channel, recipient } = (req.body as any) || {};
  if (channel !== "email" && channel !== "whatsapp") {
    res.status(400).json({ error: "channel must be email or whatsapp" });
    return;
  }
  try {
    const result = await sendNotificationTest(channel, typeof recipient === "string" ? recipient : undefined);
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(502).json({ ok: false, error: error instanceof Error ? error.message : "Notification test failed" });
  }
});

router.get("/admin/analytics", requireAdmin, async (_req, res): Promise<void> => {
  const [orders, products] = await Promise.all([
    db.select().from(ordersTable).orderBy(desc(ordersTable.createdAt)),
    db.select().from(productsTable).orderBy(asc(productsTable.createdAt)),
  ]);
  const byStatus: Record<string, number> = {};
  const byGovernorate: Record<string, number> = {};
  const productSales = new Map<string, { name: string; quantity: number; revenue: number }>();
  for (const order of orders) {
    byStatus[order.status] = (byStatus[order.status] ?? 0) + 1;
    byGovernorate[order.governorate] = (byGovernorate[order.governorate] ?? 0) + 1;
    for (const item of order.items ?? []) {
      const current = productSales.get(item.name) ?? { name: item.name, quantity: 0, revenue: 0 };
      current.quantity += item.qty;
      current.revenue += item.qty * item.price;
      productSales.set(item.name, current);
    }
  }
  res.json({
    totals: {
      orders: orders.length,
      grossSales: +orders.reduce((sum, order) => sum + order.total, 0).toFixed(3),
      visibleProducts: products.filter((product) => product.isVisible).length,
      products: products.length,
    },
    ordersByStatus: byStatus,
    ordersByGovernorate: byGovernorate,
    topProducts: [...productSales.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 10),
  });
});

router.patch("/admin/settings", requireAdmin, async (req, res): Promise<void> => {
  const { notifyEmail, notifyPhone, transferDetails } = (req.body as any) || {};
  if (typeof notifyEmail !== "string" || !notifyEmail.includes("@")) {
    res.status(400).json({ error: "A valid notifyEmail is required" });
    return;
  }
  if (typeof notifyPhone !== "string" || !/^\+\d{6,15}$/.test(notifyPhone)) {
    res.status(400).json({ error: "notifyPhone must be in international format, e.g. +96879162199" });
    return;
  }
  if (transferDetails !== undefined && (typeof transferDetails !== "string" || transferDetails.length > 4000)) {
    res.status(400).json({ error: "transferDetails must be text up to 4000 characters" });
    return;
  }
  await getOrCreateSettings();
  const updates: { notifyEmail: string; notifyPhone: string; transferDetails?: string } = { notifyEmail, notifyPhone };
  if (transferDetails !== undefined) updates.transferDetails = transferDetails;
  const [updated] = await db.update(notificationSettingsTable).set(updates).returning();
  res.json(publicSettings(updated));
});

export default router;