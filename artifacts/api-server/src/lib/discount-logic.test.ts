import { describe, expect, it } from "vitest";
import type { DiscountCode } from "@workspace/db";
import { evaluateDiscount, getDiscountStatus } from "./discount-logic";

const now = new Date("2026-09-29T08:00:00.000Z");
const discount = (overrides: Partial<DiscountCode> = {}): DiscountCode => ({
  id: 1,
  code: "GLAM15",
  percentage: 15,
  categories: ["Makhwar Scarfs"],
  startsAt: new Date("2026-09-01T00:00:00.000Z"),
  endsAt: new Date("2026-10-01T00:00:00.000Z"),
  isEnabled: true,
  createdAt: now,
  updatedAt: now,
  ...overrides,
});

describe("discount rules", () => {
  it("expires a code at its exact end timestamp", () => {
    expect(getDiscountStatus(discount({ endsAt: now }), now)).toBe("Expired");
  });

  it("computes savings only for eligible categories", () => {
    const result = evaluateDiscount(
      discount(),
      [{ productId: "scarf", qty: 2 }, { productId: "earrings", qty: 1 }],
      [
        { id: "scarf", category: "Makhwar Scarfs", price: 10 },
        { id: "earrings", category: "Earrings", price: 8 },
      ],
      now,
    );

    expect(result).toMatchObject({
      valid: true,
      code: "GLAM15",
      percentage: 15,
      eligibleSubtotal: 20,
      discountAmount: 3,
    });
  });

  it("rounds the discount to the store's three-decimal currency precision", () => {
    const result = evaluateDiscount(
      discount({ percentage: 15 }),
      [{ productId: "scarf", qty: 1 }],
      [{ id: "scarf", category: "Makhwar Scarfs", price: 1.01 }],
      now,
    );
    expect(result.valid && result.discountAmount).toBe(0.152);
  });

  it("rejects a code that does not match any cart category", () => {
    const result = evaluateDiscount(
      discount(),
      [{ productId: "earrings", qty: 1 }],
      [{ id: "earrings", category: "Earrings", price: 8 }],
      now,
    );
    expect(result).toMatchObject({ valid: false, message: expect.stringContaining("does not apply") });
  });

  it.each([
    ["Scheduled", { startsAt: new Date("2026-09-29T08:00:01.000Z") }],
    ["Expired", { endsAt: new Date("2026-09-29T07:59:59.000Z") }],
    ["Disabled", { isEnabled: false }],
  ] as const)("rejects a %s code using the current time and manual state", (status, overrides) => {
    const result = evaluateDiscount(
      discount(overrides),
      [{ productId: "scarf", qty: 1 }],
      [{ id: "scarf", category: "Makhwar Scarfs", price: 10 }],
      now,
    );
    expect(getDiscountStatus(discount(overrides), now)).toBe(status);
    expect(result.valid).toBe(false);
  });
});