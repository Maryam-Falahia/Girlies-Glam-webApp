import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fixtures = vi.hoisted(() => ({
  discounts: [] as Array<Record<string, any>>,
  products: [] as Array<Record<string, any>>,
  nextId: 1,
}));

vi.mock("drizzle-orm", () => ({
  and: (...conditions: unknown[]) => ({ conditions }),
  desc: (column: unknown) => column,
  eq: (column: unknown, value: unknown) => ({ column, operator: "eq", value }),
  inArray: (column: unknown, value: unknown[]) => ({ column, operator: "in", value }),
  ne: (column: unknown, value: unknown) => ({ column, operator: "ne", value }),
}));

vi.mock("../middlewares/auth", () => ({
  requireAdmin: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("@workspace/db", () => {
  const discountCodesTable = {
    id: { name: "id" },
    code: { name: "code" },
    createdAt: { name: "createdAt" },
  };
  const productsTable = {
    id: { name: "id" },
    category: { name: "category" },
    price: { name: "price" },
  };
  const matches = (rows: Array<Record<string, any>>, condition: any) => {
    const conditions = condition?.conditions || (condition ? [condition] : []);
    return rows.filter((row) => conditions.every(({ column, operator, value }: any) => {
      const current = row[column.name];
      if (operator === "in") return value.includes(current);
      if (operator === "ne") return current !== value;
      return current === value;
    }));
  };
  const db = {
    select: vi.fn(() => ({
      from: vi.fn((table: unknown) => ({
        where: vi.fn(async (condition: any) => matches(
          table === discountCodesTable ? fixtures.discounts : fixtures.products,
          condition,
        )),
        orderBy: vi.fn(async () => fixtures.discounts),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn((values: Record<string, unknown>) => ({
        returning: vi.fn(async () => {
          const record = {
            ...values,
            id: fixtures.nextId++,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          fixtures.discounts.push(record);
          return [record];
        }),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn((values: Record<string, unknown>) => ({
        where: vi.fn((condition: any) => ({
          returning: vi.fn(async () => {
            const [record] = matches(fixtures.discounts, condition);
            if (!record) return [];
            Object.assign(record, values, { updatedAt: new Date() });
            return [record];
          }),
        })),
      })),
    })),
  };
  return { db, discountCodesTable, productsTable };
});

import discountsRouter from "./discounts";

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use(discountsRouter);
  return instance;
}

const activeCode = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  code: "GLAM15",
  percentage: 15,
  categories: ["Makhwar Scarfs"],
  startsAt: new Date("2020-01-01T00:00:00.000Z"),
  endsAt: new Date("2050-01-01T00:00:00.000Z"),
  isEnabled: true,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  ...overrides,
});

describe("discount routes", () => {
  beforeEach(() => {
    fixtures.discounts = [activeCode()];
    fixtures.products = [
      { id: "scarf", category: "Makhwar Scarfs", price: 10 },
      { id: "earrings", category: "Earrings", price: 8 },
    ];
    fixtures.nextId = 2;
  });

  it("validates savings against only eligible cart categories", async () => {
    const response = await request(app())
      .post("/discounts/validate")
      .send({
        code: " glam15 ",
        lines: [{ productId: "scarf", qty: 2 }, { productId: "earrings", qty: 1 }],
      })
      .expect(200);

    expect(response.body).toMatchObject({
      valid: true,
      code: "GLAM15",
      eligibleSubtotal: 20,
      discountAmount: 3,
    });
  });

  it("creates normalized codes and keeps them in admin history", async () => {
    const response = await request(app())
      .post("/admin/discounts")
      .send({
        code: "eid20",
        percentage: 20,
        categories: ["Earrings"],
        startsAt: "2020-01-01T00:00:00.000Z",
        endsAt: "2050-01-01T00:00:00.000Z",
        isEnabled: true,
      })
      .expect(201);

    expect(response.body.code).toBe("EID20");
    const history = await request(app()).get("/admin/discounts").expect(200);
    expect(history.body.discounts.map((discount: { code: string }) => discount.code)).toContain("EID20");
  });

  it("rejects duplicate names and allows admins to disable a code", async () => {
    await request(app())
      .post("/admin/discounts")
      .send({
        code: "glam15",
        percentage: 10,
        categories: ["Makhwar Scarfs"],
        startsAt: "2020-01-01T00:00:00.000Z",
        endsAt: "2050-01-01T00:00:00.000Z",
        isEnabled: true,
      })
      .expect(409);

    const response = await request(app())
      .patch("/admin/discounts/1")
      .send({ isEnabled: false })
      .expect(200);
    expect(response.body).toMatchObject({ isEnabled: false, status: "Disabled" });
  });
});