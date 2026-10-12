import { Router, type IRouter } from "express";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { db, discountCodesTable, productsTable } from "@workspace/db";
import { CreateDiscountBody, UpdateDiscountBody, ValidateDiscountBody } from "@workspace/api-zod";
import { requireAdmin } from "../middlewares/auth";
import { DISCOUNT_CATEGORIES, evaluateDiscount, getDiscountStatus, type DiscountLine } from "../lib/discount-logic";

const router: IRouter = Router();
const CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{0,39}$/;

function dateValue(value: unknown): Date | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value;
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function discountResponse(discount: typeof discountCodesTable.$inferSelect) {
  return { ...discount, status: getDiscountStatus(discount) };
}

function parseDiscountInput(value: unknown): { data?: typeof discountCodesTable.$inferInsert; error?: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { error: "Discount details are required" };
  const body = value as Record<string, unknown>;
  const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
  const percentage = Number(body.percentage);
  const categories = body.categories;
  const startsAt = dateValue(body.startsAt);
  const endsAt = dateValue(body.endsAt);
  if (!CODE_PATTERN.test(code)) return { error: "Use a code with 1–40 letters, numbers, hyphens, or underscores" };
  if (!Number.isInteger(percentage) || percentage < 1 || percentage > 100) return { error: "Discount percentage must be a whole number from 1 to 100" };
  if (!Array.isArray(categories) || !categories.length || categories.some((category) => typeof category !== "string" || !DISCOUNT_CATEGORIES.includes(category as (typeof DISCOUNT_CATEGORIES)[number]))) {
    return { error: "Choose at least one valid product category" };
  }
  if (new Set(categories).size !== categories.length) return { error: "Each product category can only be selected once" };
  if (!startsAt || !endsAt || startsAt >= endsAt) return { error: "Choose a valid start and end time; the end must be after the start" };
  if (typeof body.isEnabled !== "boolean") return { error: "isEnabled must be true or false" };
  return {
    data: {
      code,
      percentage,
      categories: categories as string[],
      startsAt,
      endsAt,
      isEnabled: body.isEnabled,
    },
  };
}

function parseDiscountId(value: string | string[]): number | null {
  if (typeof value !== "string") return null;
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function isUniqueViolation(error: unknown): boolean {
  return !!error && typeof error === "object" && "code" in error && error.code === "23505";
}

router.post("/discounts/validate", async (req, res): Promise<void> => {
  const input = ValidateDiscountBody.safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ valid: false, message: input.error.message });
    return;
  }
  const code = input.data.code.trim().toUpperCase();
  const rawLines = input.data.lines;
  if (!code || rawLines.length < 1 || rawLines.length > 100) {
    res.status(400).json({ valid: false, message: "Enter a promo code and between 1 and 100 cart items." });
    return;
  }

  const lines: DiscountLine[] = [];
  for (const line of rawLines) {
    if (!line || typeof line.productId !== "string" || !line.productId || !Number.isInteger(line.qty) || line.qty < 1 || line.qty > 99) {
      res.status(400).json({ valid: false, message: "Cart items must include a product and quantity from 1 to 99." });
      return;
    }
    lines.push({ productId: line.productId, qty: line.qty });
  }

  const [discount] = await db.select().from(discountCodesTable).where(eq(discountCodesTable.code, code));
  const products = await db
    .select({ id: productsTable.id, category: productsTable.category, price: productsTable.price })
    .from(productsTable)
    .where(inArray(productsTable.id, [...new Set(lines.map((line) => line.productId))]));
  res.json(evaluateDiscount(discount, lines, products));
});

router.get("/admin/discounts", requireAdmin, async (_req, res): Promise<void> => {
  const discounts = await db.select().from(discountCodesTable).orderBy(desc(discountCodesTable.createdAt));
  res.json({ discounts: discounts.map(discountResponse), categories: DISCOUNT_CATEGORIES });
});

router.post("/admin/discounts", requireAdmin, async (req, res): Promise<void> => {
  const input = CreateDiscountBody.safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ error: input.error.message });
    return;
  }
  const parsed = parseDiscountInput(input.data);
  if (!parsed.data) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  const [existing] = await db.select({ id: discountCodesTable.id }).from(discountCodesTable).where(eq(discountCodesTable.code, parsed.data.code));
  if (existing) {
    res.status(409).json({ error: "A promo code with that name already exists" });
    return;
  }

  try {
    const [discount] = await db.insert(discountCodesTable).values(parsed.data).returning();
    res.status(201).json(discountResponse(discount));
  } catch (error) {
    if (isUniqueViolation(error)) {
      res.status(409).json({ error: "A promo code with that name already exists" });
      return;
    }
    throw error;
  }
});

router.patch("/admin/discounts/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseDiscountId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Discount id must be a positive integer" });
    return;
  }
  if (!req.body || typeof req.body !== "object" || !Object.keys(req.body).length) {
    res.status(400).json({ error: "At least one discount field must be provided" });
    return;
  }

  const [existing] = await db.select().from(discountCodesTable).where(eq(discountCodesTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Promo code not found" });
    return;
  }
  const input = UpdateDiscountBody.safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ error: input.error.message });
    return;
  }
  const merged = { ...existing, ...input.data };
  const parsed = parseDiscountInput(merged);
  if (!parsed.data) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  const [duplicate] = await db
    .select({ id: discountCodesTable.id })
    .from(discountCodesTable)
    .where(and(eq(discountCodesTable.code, parsed.data.code), ne(discountCodesTable.id, id)));
  if (duplicate) {
    res.status(409).json({ error: "A promo code with that name already exists" });
    return;
  }

  try {
    const [discount] = await db.update(discountCodesTable).set(parsed.data).where(eq(discountCodesTable.id, id)).returning();
    if (!discount) {
      res.status(404).json({ error: "Promo code not found" });
      return;
    }
    res.json(discountResponse(discount));
  } catch (error) {
    if (isUniqueViolation(error)) {
      res.status(409).json({ error: "A promo code with that name already exists" });
      return;
    }
    throw error;
  }
});

export default router;