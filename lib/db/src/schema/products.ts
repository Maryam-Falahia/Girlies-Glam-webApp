import {
  pgTable,
  text,
  timestamp,
  real,
  boolean,
  integer,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const productsTable = pgTable("products", {
  id: text("id").primaryKey(), // PRD-001 format
  name: text("name").notNull(),
  category: text("category").notNull(),
  price: real("price").notNull(),
  compareAt: real("compare_at"),
  colorway: text("colorway").notNull(),
  swatch: text("swatch").notNull(),
  sizes: text("sizes").array().notNull(),
  isNew: boolean("is_new").notNull().default(false),
  isBestseller: boolean("is_bestseller").notNull().default(false),
  isVisible: boolean("is_visible").notNull().default(true),
  rating: real("rating").notNull(),
  reviews: integer("reviews").notNull(),
  description: text("description").notNull(),
  imageUrl: text("image_url"),
  variants: jsonb("variants").$type<{ colorway: string; swatch: string; imageUrl?: string | null }[]>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertProductSchema = createInsertSchema(productsTable).omit({
  createdAt: true,
});
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type GGProduct = typeof productsTable.$inferSelect;
