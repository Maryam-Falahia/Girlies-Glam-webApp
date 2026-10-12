import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  productPrice: 10,
  discount: undefined as Record<string, unknown> | undefined,
  insertedOrder: undefined as Record<string, unknown> | undefined,
  insertedOrders: [] as Record<string, unknown>[],
  ordersByPaymentIntent: new Map<string, Record<string, unknown>>(),
  nextOrderRef: 100000,
  notifyNewOrder: vi.fn(),
}));

vi.mock("drizzle-orm", () => ({
  and: (...conditions: unknown[]) => ({ conditions }),
  desc: (column: unknown) => column,
  eq: (column: unknown, value: unknown) => ({ column, value }),
  inArray: (column: unknown, values: unknown[]) => ({ column, values }),
}));
vi.mock("../middlewares/auth", () => ({
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
  requireAdmin: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock("../lib/auth", () => ({ getUserId: () => 7 }));
vi.mock("../lib/notify", () => ({ notifyNewOrder: mocks.notifyNewOrder }));
vi.mock("../lib/receipt-content-validation", () => ({
  validateReceiptContent: vi.fn(async () => ({ valid: true, text: "Bank transfer receipt OMR 10.000" })),
}));
vi.mock("@workspace/db", () => {
  const productsTable = { id: {} };
  const discountCodesTable = { code: {} };
  const ordersTable = { paymentIntentId: {}, userId: {}, orderRef: {}, createdAt: {} };
  const select = vi.fn(() => ({
    from: vi.fn((table: unknown) => {
      if (table === productsTable) {
        return { where: vi.fn(async () => [{ id: "dress", name: "Dress", category: "Makhwar Scarfs", price: mocks.productPrice }]) };
      }
      if (table === discountCodesTable) {
        return { where: vi.fn(async (condition: { value?: unknown }) => condition.value === mocks.discount?.code ? [mocks.discount] : []) };
      }
      return {
        where: vi.fn(async (condition: { conditions?: Array<{ column: unknown; value: unknown }> }) => {
          const paymentCondition = condition.conditions?.find((entry) => entry.column === ordersTable.paymentIntentId);
          const userCondition = condition.conditions?.find((entry) => entry.column === ordersTable.userId);
          const order = paymentCondition ? mocks.ordersByPaymentIntent.get(String(paymentCondition.value)) : undefined;
          return order && (!userCondition || order.userId === userCondition.value) ? [order] : [];
        }),
      };
    }),
  }));
  const insert = vi.fn(() => ({
    values: vi.fn((values: Record<string, unknown>) => ({
      onConflictDoNothing: vi.fn(() => ({
        returning: vi.fn(async () => {
          await Promise.resolve();
          const paymentIntentId = String(values.paymentIntentId);
          if (mocks.ordersByPaymentIntent.has(paymentIntentId)) return [];
          const order = {
            ...values,
            id: mocks.insertedOrders.length + 1,
            orderRef: `GG-${mocks.nextOrderRef++}`,
            createdAt: new Date("2026-09-17T00:00:00Z"),
          };
          mocks.insertedOrder = values;
          mocks.insertedOrders.push(order);
          mocks.ordersByPaymentIntent.set(paymentIntentId, order);
          return [order];
        }),
      })),
    })),
  }));
  return { db: { select, insert }, discountCodesTable, ordersTable, productsTable, usersTable: {} };
});

import ordersRouter from "./orders";

const validOrder = {
  lines: [{ productId: "dress", size: "M", qty: 1 }],
  shippingName: "Customer",
  phone: "+968 79162199",
  governorate: "Muscat",
  wilayat: "Muscat",
  postalCode: "100",
  language: "ar",
  paymentIntentId: "payment-1",
  transferReceipt: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
};

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use(ordersRouter);
  return instance;
}

describe("order creation safeguards", () => {
  beforeEach(() => {
    mocks.productPrice = 10;
    mocks.discount = undefined;
    mocks.insertedOrder = undefined;
    mocks.insertedOrders.length = 0;
    mocks.ordersByPaymentIntent.clear();
    mocks.nextOrderRef = 100000;
    mocks.notifyNewOrder.mockReset();
    mocks.notifyNewOrder.mockResolvedValue(undefined);
  });

  it.each(["+96879162199", "+971 79162199", "+968 1234567", "+968 123456789"])(
    "rejects invalid Oman customer phone %s",
    async (phone) => {
      await request(app()).post("/orders").send({ ...validOrder, phone }).expect(400);
      expect(mocks.insertedOrder).toBeUndefined();
    },
  );

  it("requires a transfer receipt before creating an order", async () => {
    const response = await request(app()).post("/orders").send({ ...validOrder, transferReceipt: undefined }).expect(400);
    expect(response.body.error).toMatch(/transferReceipt|transfer receipt/i);
    expect(mocks.insertedOrder).toBeUndefined();
  });

  it.each([
    ["data:image/png;base64,JVBERi0xLjQK", "PNG content with a PDF signature"],
    ["data:application/pdf;base64,iVBORw0KGgo=", "PDF content with a PNG signature"],
  ])("rejects %s", async (transferReceipt) => {
    const response = await request(app()).post("/orders").send({ ...validOrder, transferReceipt }).expect(400);
    expect(response.body.error).toMatch(/valid payment receipt/i);
    expect(mocks.insertedOrder).toBeUndefined();
  });

  it.each([
    [19.24, 21.24],
    [19.25, 21.25],
  ])("adds the fixed 2.000 OMR shipping fee to every order", async (price, total) => {
    mocks.productPrice = price;
    const response = await request(app()).post("/orders").send(validOrder).expect(200);
    expect(response.body.total).toBe(total);
    expect(mocks.insertedOrder?.total).toBe(total);
  });

  it("saves and returns the order when notification delivery is unavailable", async () => {
    mocks.notifyNewOrder.mockRejectedValue(new Error("Email and WhatsApp unavailable"));
    const response = await request(app()).post("/orders").send(validOrder).expect(200);
    expect(response.body.status).toBe("Submitted");
    expect(response.body.language).toBe("ar");
    expect(mocks.insertedOrder).toMatchObject({ userId: 7, total: 12, language: "ar", wilayat: "Muscat", transferReceipt: validOrder.transferReceipt });
    expect(mocks.notifyNewOrder).toHaveBeenCalledOnce();
  });

  it("recalculates and records a valid category promo code on the order", async () => {
    mocks.discount = {
      id: 1,
      code: "GLAM15",
      percentage: 15,
      categories: ["Makhwar Scarfs"],
      startsAt: new Date("2020-01-01T00:00:00Z"),
      endsAt: new Date("2050-01-01T00:00:00Z"),
      isEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const response = await request(app())
      .post("/orders")
      .send({ ...validOrder, promoCode: " glAM15 " })
      .expect(200);

    expect(response.body).toMatchObject({ promoCode: "GLAM15", discountAmount: 1.5, total: 10.5 });
    expect(mocks.insertedOrder).toMatchObject({ promoCode: "GLAM15", discountAmount: 1.5, total: 10.5 });
  });

  it("rejects an expired promo code without creating an order", async () => {
    mocks.discount = {
      id: 1,
      code: "OLD15",
      percentage: 15,
      categories: ["Makhwar Scarfs"],
      startsAt: new Date("2020-01-01T00:00:00Z"),
      endsAt: new Date("2020-01-02T00:00:00Z"),
      isEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const response = await request(app())
      .post("/orders")
      .send({ ...validOrder, promoCode: "OLD15" })
      .expect(400);
    expect(response.body.error).toContain("expired");
    expect(mocks.insertedOrder).toBeUndefined();
  });

  it("returns the original order for simultaneous submissions with the same payment intent", async () => {
    const [first, second] = await Promise.all([
      request(app()).post("/orders").send(validOrder).expect(200),
      request(app()).post("/orders").send(validOrder).expect(200),
    ]);

    expect(first.body.id).toBe("GG-100000");
    expect(second.body.id).toBe("GG-100000");
    expect(mocks.insertedOrders).toHaveLength(1);
    expect(mocks.notifyNewOrder).toHaveBeenCalledOnce();
  });

  it("creates separate orders for different payment intents", async () => {
    const [first, second] = await Promise.all([
      request(app()).post("/orders").send({ ...validOrder, paymentIntentId: "payment-1" }).expect(200),
      request(app()).post("/orders").send({ ...validOrder, paymentIntentId: "payment-2" }).expect(200),
    ]);

    expect(first.body.id).toBe("GG-100000");
    expect(second.body.id).toBe("GG-100001");
    expect(first.body.id).not.toBe(second.body.id);
    expect(mocks.insertedOrders).toHaveLength(2);
    expect(mocks.insertedOrder).not.toHaveProperty("orderRef");
  });
});