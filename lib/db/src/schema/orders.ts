import { sql } from "drizzle-orm";
import { pgSequence, pgTable, serial, integer, text, real, timestamp, jsonb } from "drizzle-orm/pg-core";

export interface OrderItem {
  name: string;
  colorway?: string;
  size: string;
  qty: number;
  price: number;
}

export const orderRefSequence = pgSequence("order_ref_sequence", {
  startWith: 100000,
});

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  orderRef: text("order_ref")
    .notNull()
    .unique()
    .default(sql`'GG-' || nextval('order_ref_sequence')::text`),
  userId: integer("user_id").notNull(),
  status: text("status").notNull().default("Submitted"),
  total: real("total").notNull(),
  shippingFee: real("shipping_fee").notNull().default(2),
  shippingEtaMinDays: integer("shipping_eta_min_days").notNull().default(1),
  shippingEtaMaxDays: integer("shipping_eta_max_days").notNull().default(5),
  shippingName: text("shipping_name").notNull(),
  shippingAddress: text("shipping_address").notNull(),
  phone: text("phone").notNull().default(""),
  governorate: text("governorate").notNull().default(""),
  city: text("city").notNull(),
  wilayat: text("wilayat").notNull().default(""),
  postalCode: text("postal_code").notNull(),
  language: text("language").notNull().default("en"),
  paymentIntentId: text("payment_intent_id").unique(),
  promoCode: text("promo_code"),
  discountAmount: real("discount_amount").notNull().default(0),
  transferReceipt: text("transfer_receipt"),
  items: jsonb("items").$type<OrderItem[]>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
