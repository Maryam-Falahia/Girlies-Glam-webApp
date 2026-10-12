import { pgTable, integer, text, timestamp, real, boolean, serial } from "drizzle-orm/pg-core";

export const notificationSettingsTable = pgTable("notification_settings", {
  id: integer("id").primaryKey().default(1),
  notifyEmail: text("notify_email").notNull().default("memefalahia@gmail.com"),
  notifyPhone: text("notify_phone").notNull().default("+96879162199"),
  transferDetails: text("transfer_details").notNull().default(""),
  emailFailureAt: timestamp("email_failure_at", { withTimezone: true }),
  whatsappFailureAt: timestamp("whatsapp_failure_at", { withTimezone: true }),
});

/**
 * Store-wide shipping policy. Keeping this separate from notification settings
 * lets checkout quote shipping without exposing admin-only contact details.
 */
export const shippingSettingsTable = pgTable("shipping_settings", {
  id: integer("id").primaryKey().default(1),
  defaultFee: real("default_fee").notNull().default(2),
  freeShippingThreshold: real("free_shipping_threshold"),
  defaultEtaMinDays: integer("default_eta_min_days").notNull().default(1),
  defaultEtaMaxDays: integer("default_eta_max_days").notNull().default(5),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Optional governorate/wilayat overrides. A null wilayat applies to the whole
 * governorate. More specific matches always win over broad matches.
 */
export const shippingRatesTable = pgTable("shipping_rates", {
  id: serial("id").primaryKey(),
  governorate: text("governorate").notNull(),
  wilayat: text("wilayat"),
  fee: real("fee").notNull(),
  etaMinDays: integer("eta_min_days").notNull().default(1),
  etaMaxDays: integer("eta_max_days").notNull().default(5),
  isActive: boolean("is_active").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});