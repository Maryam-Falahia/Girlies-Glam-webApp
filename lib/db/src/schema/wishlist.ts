import { pgTable, serial, integer, text, timestamp, unique } from "drizzle-orm/pg-core";

export const wishlistTable = pgTable(
  "wishlist",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    productId: text("product_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("wishlist_user_product").on(t.userId, t.productId)],
);
