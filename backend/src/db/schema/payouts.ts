import { pgTable, text, integer, timestamp, numeric } from "drizzle-orm/pg-core";
import { orders } from "./orders";
import { sellers } from "./sellers";

export const payouts = pgTable("payouts", {
  id: text("id").primaryKey(),
  orderId: text("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  sellerId: text("seller_id")
    .notNull()
    .references(() => sellers.id),
  // Which order state triggered this payout
  state: text("state").notNull(),
  amountToken: numeric("amount_token", { precision: 36, scale: 18 }).notNull(),
  percentageBps: integer("percentage_bps").notNull(),
  txHash: text("tx_hash"),
  platformFeeToken: numeric("platform_fee_token", { precision: 36, scale: 18 }),
  receiptIpfsCid: text("receipt_ipfs_cid"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Payout = typeof payouts.$inferSelect;
export type NewPayout = typeof payouts.$inferInsert;
