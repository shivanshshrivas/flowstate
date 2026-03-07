import { pgTable, text, integer, jsonb, numeric } from "drizzle-orm/pg-core";
import { orders } from "./orders";

export const orderItems = pgTable("order_items", {
  id: text("id").primaryKey(),
  orderId: text("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  externalItemId: text("external_item_id"),
  name: text("name").notNull(),
  quantity: integer("quantity").notNull(),
  unitPriceUsd: numeric("unit_price_usd", { precision: 10, scale: 2 }).notNull(),
  weightOz: numeric("weight_oz", { precision: 8, scale: 2 }),
  // jsonb: { length, width, height, unit }
  dimensions: jsonb("dimensions"),
});

export type OrderItem = typeof orderItems.$inferSelect;
export type NewOrderItem = typeof orderItems.$inferInsert;
