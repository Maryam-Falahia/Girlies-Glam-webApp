import { Router, type IRouter, type Response } from "express";
import { db, discountCodesTable, ordersTable, productsTable, usersTable, type OrderItem } from "@workspace/db";
import { and, eq, inArray, desc } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { getUserId } from "../lib/auth";
import { notifyNewOrder } from "../lib/notify";
import { parseReceiptDataUrl, receiptExtension } from "../lib/receipt-validation";
import { validateReceiptContent } from "../lib/receipt-content-validation";
import { verifyReceiptDownloadToken } from "../lib/receipt-download";
import { quoteShipping } from "../lib/shipping";
import { evaluateDiscount } from "../lib/discount-logic";
import { CreateOrderBody, CreateOrderResponse, GetOrderParams } from "@workspace/api-zod";

const router: IRouter = Router();
const ORDER_STATUSES = ["Submitted","In Process","Packed","In Delivery","Received"];

function formatOrder(o: typeof ordersTable.$inferSelect) {
  return {
    id: o.orderRef,
    date: new Date(o.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }),
    items: o.items as OrderItem[],
    total: o.total,
    status: o.status as "Submitted" | "In Process" | "Packed" | "In Delivery" | "Received",
    shippingName: o.shippingName,
    shippingAddress: o.shippingAddress,
    phone: o.phone,
    governorate: o.governorate,
    wilayat: o.wilayat || o.city || o.shippingAddress,
    postalCode: o.postalCode,
    transferReceiptAvailable: Boolean(o.transferReceipt),
    language: o.language as "en" | "ar",
    paymentIntentId: o.paymentIntentId ?? null,
    promoCode: o.promoCode ?? null,
    discountAmount: o.discountAmount ?? 0,
    shippingFee: o.shippingFee ?? 2,
    shippingEtaMinDays: o.shippingEtaMinDays ?? 1,
    shippingEtaMaxDays: o.shippingEtaMaxDays ?? 5,
  };
}

router.get("/orders", requireAuth, async (req, res): Promise<void> => {
  const rows = await db.select().from(ordersTable).where(eq(ordersTable.userId, getUserId(req)!)).orderBy(desc(ordersTable.createdAt));
  res.json({ orders: rows.map(formatOrder) });
});

router.get("/orders/:id", requireAuth, async (req, res): Promise<void> => {
  const parsed = GetOrderParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [order] = await db.select().from(ordersTable).where(and(eq(ordersTable.orderRef, parsed.data.id), eq(ordersTable.userId, getUserId(req)!)));
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  res.json(formatOrder(order));
});

async function serveTransferReceipt(orderRef: string, res: Response, download = false): Promise<void> {
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.orderRef, orderRef));
  if (!order?.transferReceipt) {
    res.status(404).json({ error: "Transfer receipt not found" });
    return;
  }
  const parsed = parseReceiptDataUrl(order.transferReceipt);
  if (!parsed) {
    res.status(404).json({ error: "Transfer receipt is unavailable" });
    return;
  }
  res.setHeader("Content-Type", parsed.mimeType);
  res.setHeader(
    "Content-Disposition",
    `${download ? "attachment" : "inline"}; filename="${orderRef}-transfer-receipt.${receiptExtension(parsed.mimeType)}"`,
  );
  res.send(parsed.bytes);
}

router.get("/orders/:id/transfer-receipt", requireAuth, async (req, res): Promise<void> => {
  const [order] = await db.select().from(ordersTable).where(
    and(eq(ordersTable.orderRef, String(req.params.id)), eq(ordersTable.userId, getUserId(req)!)),
  );
  if (!order) {
    res.status(404).json({ error: "Transfer receipt not found" });
    return;
  }
  await serveTransferReceipt(order.orderRef, res);
});

router.get("/orders/:id/transfer-receipt/download", async (req, res): Promise<void> => {
  const orderRef = String(req.params.id);
  const token = typeof req.query.token === "string" ? req.query.token : "";
  if (!verifyReceiptDownloadToken(orderRef, token)) {
    res.status(403).json({ error: "Receipt download link is invalid or expired" });
    return;
  }
  await serveTransferReceipt(orderRef, res, true);
});

router.get("/admin/orders/:id/transfer-receipt", requireAdmin, async (req, res): Promise<void> => {
  await serveTransferReceipt(String(req.params.id), res);
});

router.post("/orders", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { lines, shippingName, phone, governorate, wilayat, postalCode, language, paymentIntentId, transferReceipt, promoCode } = parsed.data;
  if (!lines.length) {
    res.status(400).json({ error: "Add at least one item to your order" });
    return;
  }
  if (!/^\+968 [0-9]{8}$/.test(phone)) {
    res.status(400).json({ error: "Phone must use +968 followed by exactly 8 digits" });
    return;
  }
  const parsedReceipt = parseReceiptDataUrl(transferReceipt);
  if (!parsedReceipt) {
    res.status(400).json({ error: "A valid payment receipt image or PDF is required" });
    return;
  }
  const contentValidation = await validateReceiptContent(parsedReceipt);
  if (!contentValidation.valid) {
    res.status(400).json({ error: "The uploaded file does not appear to be a bank or phone-transfer receipt" });
    return;
  }

  const userId = getUserId(req)!;
  if (paymentIntentId) {
    const [existing] = await db
      .select()
      .from(ordersTable)
      .where(and(eq(ordersTable.paymentIntentId, paymentIntentId), eq(ordersTable.userId, userId)));
    if (existing) {
      res.json(CreateOrderResponse.parse(formatOrder(existing)));
      return;
    }
  }

  const products = await db.select().from(productsTable).where(inArray(productsTable.id, lines.map((line) => line.productId)));
  if (products.length !== new Set(lines.map((line) => line.productId)).size || lines.some((line) => !Number.isInteger(line.qty) || line.qty < 1 || line.qty > 99)) {
    res.status(400).json({ error: "One or more cart items are unavailable or have an invalid quantity" });
    return;
  }
  const productMap = new Map(products.map((product) => [product.id, product]));
  const items: OrderItem[] = lines.map((line) => {
    const product = productMap.get(line.productId);
    return { name: product?.name ?? line.productId, colorway: line.colorway, size: line.size, qty: line.qty, price: product?.price ?? 0 };
  });
  const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  let appliedPromoCode: string | null = null;
  let discountAmount = 0;
  if (promoCode?.trim()) {
    const normalizedCode = promoCode.trim().toUpperCase();
    const [discount] = await db.select().from(discountCodesTable).where(eq(discountCodesTable.code, normalizedCode));
    const result = evaluateDiscount(discount, lines, products);
    if (!result.valid) {
      res.status(400).json({ error: result.message });
      return;
    }
    appliedPromoCode = result.code;
    discountAmount = result.discountAmount;
  }
  const shipping = await quoteShipping(governorate, wilayat, subtotal);

  const inserted = await db
    .insert(ordersTable)
    .values({
      userId,
      status: "Submitted",
      total: +(Math.max(0, subtotal - discountAmount) + shipping.fee).toFixed(3),
      shippingFee: shipping.fee,
      shippingEtaMinDays: shipping.etaMinDays,
      shippingEtaMaxDays: shipping.etaMaxDays,
      shippingName,
      shippingAddress: wilayat,
      phone,
      governorate,
      city: wilayat,
      wilayat,
      postalCode,
      language,
      paymentIntentId,
      promoCode: appliedPromoCode,
      discountAmount,
      transferReceipt,
      items,
    })
    .onConflictDoNothing({ target: ordersTable.paymentIntentId })
    .returning();

  let order = inserted[0];
  if (!order && paymentIntentId) {
    [order] = await db
      .select()
      .from(ordersTable)
      .where(and(eq(ordersTable.paymentIntentId, paymentIntentId), eq(ordersTable.userId, userId)));
  }
  if (!order) {
    res.status(409).json({ error: "This payment intent is already associated with another order" });
    return;
  }

  if (inserted.length) notifyNewOrder(order).catch(() => {});
  res.json(CreateOrderResponse.parse(formatOrder(order)));
});

router.get("/admin/orders", requireAdmin, async (_req, res): Promise<void> => {
  const rows = await db
    .select({ order: ordersTable, userName: usersTable.name, userEmail: usersTable.email })
    .from(ordersTable)
    .innerJoin(usersTable, eq(ordersTable.userId, usersTable.id))
    .orderBy(desc(ordersTable.createdAt));
  res.json({ orders: rows.map((row) => ({ ...formatOrder(row.order), customerName: row.userName, customerEmail: row.userEmail })) });
});

router.patch("/admin/orders/:id/status", requireAdmin, async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const status = (req.body as any)?.status;
  if (!ORDER_STATUSES.includes(status)) {
    res.status(400).json({ error: `status must be one of: ${ORDER_STATUSES.join(", ")}` });
    return;
  }
  const [order] = await db.update(ordersTable).set({ status }).where(eq(ordersTable.orderRef, id)).returning();
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  res.json(formatOrder(order));
});

export default router;
