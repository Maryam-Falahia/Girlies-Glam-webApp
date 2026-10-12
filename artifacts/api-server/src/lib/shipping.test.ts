import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  settings: [] as Array<Record<string, unknown>>,
  rates: [] as Array<Record<string, unknown>>,
}));

vi.mock("drizzle-orm", () => ({
  eq: (column: unknown, value: unknown) => ({ column, value }),
}));

vi.mock("@workspace/db", () => {
  const shippingSettingsTable = { id: "settings" };
  const shippingRatesTable = { isActive: "active" };
  const select = vi.fn(() => ({
    from: vi.fn((table: unknown) => {
      if (table === shippingSettingsTable) return Promise.resolve(mocks.settings);
      return { where: vi.fn(async () => mocks.rates) };
    }),
  }));
  return { db: { select }, shippingSettingsTable, shippingRatesTable };
});

import { quoteShipping } from "./shipping";

describe("shipping policy quotes", () => {
  beforeEach(() => {
    mocks.settings = [];
    mocks.rates = [];
  });

  it("uses the safe default when no policy has been configured", async () => {
    await expect(quoteShipping("Muscat", "Muscat", 20)).resolves.toMatchObject({
      fee: 2,
      etaMinDays: 1,
      etaMaxDays: 5,
      matchedRateId: null,
    });
  });

  it("prefers a wilayat rate over its governorate fallback", async () => {
    mocks.settings = [{ defaultFee: 3, defaultEtaMinDays: 2, defaultEtaMaxDays: 6, freeShippingThreshold: null }];
    mocks.rates = [
      { id: 1, governorate: "Muscat", wilayat: null, fee: 2, etaMinDays: 1, etaMaxDays: 4, isActive: true },
      { id: 2, governorate: "Muscat", wilayat: "Bawshar", fee: 1, etaMinDays: 1, etaMaxDays: 2, isActive: true },
    ];

    await expect(quoteShipping("muscat", "bawshar", 20)).resolves.toMatchObject({
      fee: 1,
      etaMinDays: 1,
      etaMaxDays: 2,
      matchedRateId: 2,
    });
  });

  it("applies the configured free-shipping threshold", async () => {
    mocks.settings = [{ defaultFee: 3, defaultEtaMinDays: 2, defaultEtaMaxDays: 6, freeShippingThreshold: 50 }];
    await expect(quoteShipping("Dhofar", "Salalah", 50)).resolves.toMatchObject({ fee: 0 });
  });
});