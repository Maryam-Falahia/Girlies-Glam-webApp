import { db, shippingRatesTable, shippingSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export const SAFE_DEFAULT_SHIPPING = {
  fee: 2,
  etaMinDays: 1,
  etaMaxDays: 5,
};

export type ShippingRateInput = {
  governorate: string;
  wilayat?: string | null;
  fee: number;
  etaMinDays: number;
  etaMaxDays: number;
  isActive?: boolean;
};

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export async function getShippingPolicy() {
  try {
    const [settings] = await db.select().from(shippingSettingsTable);
    const rates = await db.select().from(shippingRatesTable).where(eq(shippingRatesTable.isActive, true));
    return {
      settings: {
        defaultFee: typeof settings?.defaultFee === "number" ? settings.defaultFee : SAFE_DEFAULT_SHIPPING.fee,
        freeShippingThreshold: settings?.freeShippingThreshold ?? null,
        defaultEtaMinDays: settings?.defaultEtaMinDays ?? SAFE_DEFAULT_SHIPPING.etaMinDays,
        defaultEtaMaxDays: settings?.defaultEtaMaxDays ?? SAFE_DEFAULT_SHIPPING.etaMaxDays,
      },
      rates: rates.map((rate) => ({
        id: rate.id,
        governorate: rate.governorate,
        wilayat: rate.wilayat,
        fee: rate.fee,
        etaMinDays: rate.etaMinDays,
        etaMaxDays: rate.etaMaxDays,
        isActive: rate.isActive,
      })),
    };
  } catch {
    // Keep order creation compatible with older databases and isolated route tests
    // until the optional shipping tables have been created.
    return {
      settings: {
        defaultFee: SAFE_DEFAULT_SHIPPING.fee,
        freeShippingThreshold: null,
        defaultEtaMinDays: SAFE_DEFAULT_SHIPPING.etaMinDays,
        defaultEtaMaxDays: SAFE_DEFAULT_SHIPPING.etaMaxDays,
      },
      rates: [],
    };
  }
}

export async function quoteShipping(governorate: string, wilayat: string, subtotal = 0) {
  const policy = await getShippingPolicy();
  const governorateKey = clean(governorate);
  const wilayatKey = clean(wilayat);
  const match = policy.rates
    .filter((rate) => clean(rate.governorate) === governorateKey)
    .sort((a, b) => Number(Boolean(clean(b.wilayat))) - Number(Boolean(clean(a.wilayat))))
    .find((rate) => !clean(rate.wilayat) || clean(rate.wilayat) === wilayatKey);

  const feeBeforeFreeShipping = match?.fee ?? policy.settings.defaultFee;
  const fee =
    policy.settings.freeShippingThreshold !== null &&
    subtotal >= policy.settings.freeShippingThreshold
      ? 0
      : feeBeforeFreeShipping;
  return {
    fee: +Number(fee).toFixed(3),
    etaMinDays: match?.etaMinDays ?? policy.settings.defaultEtaMinDays,
    etaMaxDays: match?.etaMaxDays ?? policy.settings.defaultEtaMaxDays,
    governorate,
    wilayat,
    matchedRateId: match?.id ?? null,
  };
}