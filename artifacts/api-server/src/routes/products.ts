import { Router, type IRouter } from "express";
import { db, productReviewsTable, productsTable, usersTable } from "@workspace/db";
import { and, eq, ilike, desc, asc, isNotNull, isNull } from "drizzle-orm";
import {
  ListProductsQueryParams,
  ListProductsResponse,
  GetFeaturedProductsResponse,
  GetProductResponse,
  GetProductParams,
} from "@workspace/api-zod";
import { requireAdmin, requireAuth } from "../middlewares/auth";
import { getUserId } from "../lib/auth";

const router: IRouter = Router();

// Must be before /:id to avoid route conflict
router.get("/products/featured", async (_req, res): Promise<void> => {
  const [bestsellers, newArrivals] = await Promise.all([
    db.select().from(productsTable).where(and(eq(productsTable.isBestseller, true), eq(productsTable.isVisible, true))).limit(4),
    db.select().from(productsTable).where(and(eq(productsTable.isNew, true), eq(productsTable.isVisible, true))).limit(4),
  ]);

  res.json({ bestsellers, newArrivals });
});

router.get("/products/:id/reviews", async (req, res): Promise<void> => {
  const params = GetProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const reviews = await db
    .select({
      id: productReviewsTable.id,
      productId: productReviewsTable.productId,
      rating: productReviewsTable.rating,
      title: productReviewsTable.title,
      body: productReviewsTable.body,
      createdAt: productReviewsTable.createdAt,
      customerName: usersTable.name,
    })
    .from(productReviewsTable)
    .innerJoin(usersTable, eq(usersTable.id, productReviewsTable.userId))
    .where(and(eq(productReviewsTable.productId, params.data.id), eq(productReviewsTable.moderationStatus, "visible")))
    .orderBy(desc(productReviewsTable.createdAt));

  const userId = getUserId(req);
  let myReviewStatus: string | undefined;
  if (userId) {
    const [ownReview] = await db
      .select({ moderationStatus: productReviewsTable.moderationStatus })
      .from(productReviewsTable)
      .where(and(eq(productReviewsTable.productId, params.data.id), eq(productReviewsTable.userId, userId)));
    myReviewStatus = ownReview?.moderationStatus;
  }

  res.json({ reviews, ...(myReviewStatus ? { myReviewStatus } : {}) });
});

router.post("/products/:id/reviews", requireAuth, async (req, res): Promise<void> => {
  const params = GetProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const rating = Number(req.body?.rating);
  const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
  const body = typeof req.body?.body === "string" ? req.body.body.trim() : "";
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    res.status(400).json({ error: "rating must be an integer from 1 to 5" });
    return;
  }
  if (body.length < 3 || body.length > 2000) {
    res.status(400).json({ error: "Review text must be between 3 and 2000 characters" });
    return;
  }
  if (title.length > 120) {
    res.status(400).json({ error: "Review title must be 120 characters or fewer" });
    return;
  }

  const [product] = await db
    .select({ id: productsTable.id })
    .from(productsTable)
    .where(and(eq(productsTable.id, params.data.id), eq(productsTable.isVisible, true)));
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  const userId = getUserId(req)!;
  const [existing] = await db
    .select({ id: productReviewsTable.id })
    .from(productReviewsTable)
    .where(and(eq(productReviewsTable.productId, params.data.id), eq(productReviewsTable.userId, userId)));
  if (existing) {
    res.status(409).json({ error: "You have already reviewed this product" });
    return;
  }

  const [review] = await db
    .insert(productReviewsTable)
    .values({ productId: params.data.id, userId, rating, title, body, moderationStatus: "pending" })
    .returning();
  const [user] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, userId));
  res.status(201).json({ ...review, customerName: user?.name ?? "Customer" });
});

const REVIEW_MODERATION_STATUSES = ["visible", "hidden", "pending"] as const;
type ReviewModerationStatus = (typeof REVIEW_MODERATION_STATUSES)[number];

function parseReviewId(value: string | string[]): number | null {
  if (typeof value !== "string") return null;
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

router.get("/admin/reviews", requireAdmin, async (_req, res): Promise<void> => {
  const reviews = await db
    .select({
      id: productReviewsTable.id,
      productId: productReviewsTable.productId,
      productName: productsTable.name,
      userId: productReviewsTable.userId,
      customerName: usersTable.name,
      customerEmail: usersTable.email,
      rating: productReviewsTable.rating,
      title: productReviewsTable.title,
      body: productReviewsTable.body,
      moderationStatus: productReviewsTable.moderationStatus,
      createdAt: productReviewsTable.createdAt,
    })
    .from(productReviewsTable)
    .innerJoin(productsTable, eq(productsTable.id, productReviewsTable.productId))
    .innerJoin(usersTable, eq(usersTable.id, productReviewsTable.userId))
    .orderBy(desc(productReviewsTable.createdAt));

  res.json({ reviews });
});

router.patch("/admin/reviews/:id/status", requireAdmin, async (req, res): Promise<void> => {
  const id = parseReviewId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Review id must be a positive integer" });
    return;
  }

  const moderationStatus = req.body?.moderationStatus;
  if (!REVIEW_MODERATION_STATUSES.includes(moderationStatus as ReviewModerationStatus)) {
    res.status(400).json({ error: "moderationStatus must be visible, hidden, or pending" });
    return;
  }

  const [review] = await db
    .update(productReviewsTable)
    .set({ moderationStatus: moderationStatus as ReviewModerationStatus })
    .where(eq(productReviewsTable.id, id))
    .returning();

  if (!review) {
    res.status(404).json({ error: "Review not found" });
    return;
  }
  res.json(review);
});

router.delete("/admin/reviews/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseReviewId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Review id must be a positive integer" });
    return;
  }

  const [review] = await db
    .delete(productReviewsTable)
    .where(eq(productReviewsTable.id, id))
    .returning({ id: productReviewsTable.id });

  if (!review) {
    res.status(404).json({ error: "Review not found" });
    return;
  }
  res.status(204).send();
});

router.get("/products/:id", async (req, res): Promise<void> => {
  const params = GetProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [product] = await db
    .select()
    .from(productsTable)
    .where(and(eq(productsTable.id, params.data.id), eq(productsTable.isVisible, true)));

  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  res.json(product);
});

router.get("/products", async (req, res): Promise<void> => {
  const queryParsed = ListProductsQueryParams.safeParse(req.query);
  if (!queryParsed.success) {
    res.status(400).json({ error: queryParsed.error.message });
    return;
  }

  const { category, search, sort, onSale, isNew, isBestseller } = queryParsed.data;

  const conditions = [];
  conditions.push(eq(productsTable.isVisible, true));
  if (category) conditions.push(eq(productsTable.category, category));
  if (search) conditions.push(ilike(productsTable.name, `%${search}%`));
  if (isNew !== undefined) conditions.push(eq(productsTable.isNew, isNew));
  if (isBestseller !== undefined) conditions.push(eq(productsTable.isBestseller, isBestseller));
  if (onSale !== undefined) {
    if (onSale) conditions.push(isNotNull(productsTable.compareAt));
    else conditions.push(isNull(productsTable.compareAt));
  }

  const orderByClause =
    sort === "price_asc"
      ? asc(productsTable.price)
      : sort === "price_desc"
        ? desc(productsTable.price)
        : sort === "rating"
          ? desc(productsTable.rating)
          : asc(productsTable.createdAt);

  const products = await db
    .select()
    .from(productsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(orderByClause);

  res.json({ products, total: products.length });
});

router.get("/admin/products", requireAdmin, async (_req, res): Promise<void> => {
  const products = await db.select().from(productsTable).orderBy(asc(productsTable.createdAt));
  res.json({ products, total: products.length });
});

const JEWELRY_CATEGORIES = new Set(["Earrings", "Full Sets", "Necklace", "Bracelet", "Rings"]);
const JEWELRY_COLORS = new Set(["Silver", "Gold", "Golden Rose"]);
const MAX_PRODUCT_IMAGE_LENGTH = 6_000_000;
const HEX_SWATCHES: Record<string, string> = {
  silver: "#c9c9c9",
  gold: "#d9ad45",
  "golden rose": "#d99a91",
  "rose gold": "#d99a91",
  black: "#222222",
  white: "#f7f7f2",
  ivory: "#f4ecd8",
  green: "#71936a",
  orange: "#d8872f",
  yellow: "#d9c34a",
  blue: "#65799f",
  pink: "#e3a7b7",
  purple: "#8a5f8f",
  lilac: "#b9a1cb",
  turquoise: "#5bb8bf",
  beige: "#c8b497",
  gray: "#9ca3a8",
  olive: "#929b65",
};

function swatchFor(color: string): string {
  return HEX_SWATCHES[color.trim().toLowerCase()] || "#d9a8de";
}

function parseProductInput(body: any, partial = false): Record<string, any> | { error: string } {
  const requiredText = ["name", "category", "description"];
  if (!partial) {
    for (const field of requiredText) {
      if (typeof body?.[field] !== "string" || !body[field].trim()) return { error: `${field} is required` };
    }
  }

  const colors = Array.isArray(body?.colors)
    ? body.colors.filter((color: unknown): color is string => typeof color === "string" && color.trim().length > 0).map((color: string) => color.trim())
    : [];
  if (!partial && colors.length === 0) return { error: "At least one product color is required" };
  if (JEWELRY_CATEGORIES.has(String(body?.category)) && colors.some((color: string) => !JEWELRY_COLORS.has(color))) {
    return { error: "Jewellery colors must be Silver, Gold, or Golden Rose" };
  }

  const sizes = Array.isArray(body?.sizes)
    ? body.sizes.filter((size: unknown): size is string => typeof size === "string" && size.trim().length > 0).map((size: string) => size.trim())
    : [];
  if (!partial && sizes.length === 0) return { error: "At least one product size is required" };

  const imageUrl = body?.imageUrl;
  if (imageUrl !== undefined && imageUrl !== null) {
    if (typeof imageUrl !== "string" || imageUrl.length > MAX_PRODUCT_IMAGE_LENGTH ||
      (!imageUrl.startsWith("/products/") && !/^data:image\/(jpeg|png|webp);base64,/i.test(imageUrl))) {
      return { error: "Product image must be a stored product path or a JPG, PNG, or WEBP image smaller than 4 MB" };
    }
  }

  const price = body?.price === undefined ? undefined : Number(body.price);
  if (price !== undefined && (!Number.isFinite(price) || price < 0)) return { error: "Price must be a non-negative number" };
  const compareAt = body?.compareAt === undefined || body.compareAt === "" || body.compareAt === null ? null : Number(body.compareAt);
  if (compareAt !== null && (!Number.isFinite(compareAt) || compareAt < 0)) return { error: "Compare-at price must be a non-negative number" };

  if (partial) {
    const updates: Record<string, any> = {};
    if (typeof body.name === "string") updates.name = body.name.trim();
    if (typeof body.category === "string") updates.category = body.category.trim();
    if (price !== undefined) updates.price = price;
    if (compareAt !== undefined) updates.compareAt = compareAt;
    if (typeof body.description === "string") updates.description = body.description.trim();
    if (imageUrl !== undefined) updates.imageUrl = imageUrl;
    if (colors.length) {
      updates.colorway = colors[0];
      updates.swatch = swatchFor(colors[0]);
      updates.variants = colors.slice(1).map((color: string) => ({ colorway: color, swatch: swatchFor(color), imageUrl: imageUrl ?? null }));
    }
    if (sizes.length) updates.sizes = sizes;
    for (const field of ["isNew", "isBestseller", "isVisible"]) {
      if (typeof body[field] === "boolean") updates[field] = body[field];
    }
    return updates;
  }

  const firstColor = colors[0];
  return {
    name: body.name.trim(),
    category: body.category.trim(),
    price,
    compareAt,
    colorway: firstColor,
    swatch: swatchFor(firstColor),
    sizes,
    isNew: Boolean(body.isNew),
    isBestseller: Boolean(body.isBestseller),
    isVisible: body.isVisible === undefined ? true : Boolean(body.isVisible),
    rating: Number.isFinite(Number(body.rating)) ? Number(body.rating) : 5,
    reviews: Number.isFinite(Number(body.reviews)) ? Math.max(0, Math.floor(Number(body.reviews))) : 0,
    description: body.description.trim(),
    imageUrl: imageUrl ?? null,
    variants: colors.slice(1).map((color: string) => ({ colorway: color, swatch: swatchFor(color), imageUrl: imageUrl ?? null })),
  };
}

router.post("/admin/products", requireAdmin, async (req, res): Promise<void> => {
  const parsed = parseProductInput(req.body);
  if ("error" in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const id = typeof req.body?.id === "string" && /^PRD-[A-Z0-9-]+$/.test(req.body.id)
    ? req.body.id
    : `PRD-${Date.now().toString(36).toUpperCase()}`;
  const [product] = await db.insert(productsTable).values({ id, ...(parsed as any) }).returning();
  res.status(201).json(product);
});

router.patch("/admin/products/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = GetProductParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = parseProductInput(req.body, true);
  if ("error" in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const [product] = await db.update(productsTable).set(parsed).where(eq(productsTable.id, params.data.id)).returning();
  if (!product) { res.status(404).json({ error: "Product not found" }); return; }
  res.json(product);
});

router.patch("/admin/products/:id/visibility", requireAdmin, async (req, res): Promise<void> => {
  const params = GetProductParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const isVisible = req.body?.isVisible;
  if (typeof isVisible !== "boolean") { res.status(400).json({ error: "isVisible must be true or false" }); return; }
  const [product] = await db.update(productsTable).set({ isVisible }).where(eq(productsTable.id, params.data.id)).returning();
  if (!product) { res.status(404).json({ error: "Product not found" }); return; }
  res.json(product);
});

router.delete("/admin/products/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = GetProductParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [product] = await db.delete(productsTable)
    .where(eq(productsTable.id, params.data.id))
    .returning({ id: productsTable.id });

  if (!product) { res.status(404).json({ error: "Product not found" }); return; }
  res.status(204).send();
});

export default router;
