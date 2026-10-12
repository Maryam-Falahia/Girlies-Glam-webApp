import { pgTable, serial, text, integer, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const productReviewsTable = pgTable(
  "product_reviews",
  {
    id: serial("id").primaryKey(),
    productId: text("product_id").notNull(),
    userId: integer("user_id").notNull(),
    rating: integer("rating").notNull(),
    title: text("title").notNull().default(""),
    body: text("body").notNull(),
    moderationStatus: text("moderation_status").notNull().default("visible"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    productUserUnique: uniqueIndex("product_reviews_product_user_idx").on(table.productId, table.userId),
  }),
);

export const insertProductReviewSchema = createInsertSchema(productReviewsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertProductReview = z.infer<typeof insertProductReviewSchema>;
export type ProductReview = typeof productReviewsTable.$inferSelect;