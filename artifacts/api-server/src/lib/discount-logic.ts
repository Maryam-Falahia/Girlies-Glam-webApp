import type { DiscountCode, GGProduct } from "@workspace/db";

export const DISCOUNT_CATEGORIES = [
  "Cotton Makhwar",
  "Italy Silk Makhwar",
  "Digital Cotton Liberty",
  "Cotton Amoudi Makhwar",
  "Makhwar Scarfs",
  "Earrings",
  "Full Sets",
  "Necklace",
  "Bracelet",
  "Rings",
] as const;

export type DiscountStatus = "Scheduled" | "Active" | "Expired" | "Disabled";
export type DiscountLine = { productId: string; qty: number };

export function getDiscountStatus(discount: Pick<DiscountCode, "startsAt" | "endsAt" | "isEnabled">, now = new Date()): DiscountStatus {
  if (now >= discount.endsAt) return "Expired";
  if (!discount.isEnabled) return "Disabled";
  if (now < discount.startsAt) return "Scheduled";
  return "Active";
}

export function evaluateDiscount(
  discount: DiscountCode | undefined,
  lines: DiscountLine[],
  products: Pick<GGProduct, "id" | "category" | "price">[],
  now = new Date(),
) {
  if (!discount) return { valid: false as const, message: "That promo code was not found." };

  const status = getDiscountStatus(discount, now);
  if (status === "Disabled") return { valid: false as const, message: "This promo code has been disabled by the store." };
  if (status === "Scheduled") return { valid: false as const, message: "This promo code is not active yet." };
  if (status === "Expired") return { valid: false as const, message: "This promo code has expired." };

  const productMap = new Map(products.map((product) => [product.id, product]));
  const eligibleSubtotal = lines.reduce((sum, line) => {
    const product = productMap.get(line.productId);
    return product && discount.categories.includes(product.category)
      ? sum + product.price * line.qty
      : sum;
  }, 0);

  if (eligibleSubtotal <= 0) {
    return { valid: false as const, message: "This promo code does not apply to the items in your bag." };
  }

  const discountAmount = Math.min(
    eligibleSubtotal,
    Math.round((eligibleSubtotal * discount.percentage / 100 + Number.EPSILON) * 1000) / 1000,
  );

  return {
    valid: true as const,
    message: `${discount.percentage}% discount applied to eligible items.`,
    code: discount.code,
    percentage: discount.percentage,
    eligibleSubtotal: Math.round((eligibleSubtotal + Number.EPSILON) * 1000) / 1000,
    discountAmount,
  };
}