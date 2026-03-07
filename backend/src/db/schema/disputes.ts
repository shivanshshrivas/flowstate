import { pgTable, pgEnum, text, integer, timestamp, numeric } from "drizzle-orm/pg-core";
import { orders } from "./orders";

export const disputeStatusEnum = pgEnum("dispute_status", [
  "OPEN",
  "SELLER_RESPONDED",
  "UNDER_REVIEW",
  "RESOLVED_BUYER",
  "RESOLVED_SELLER",
  "RESOLVED_SPLIT",
  "AUTO_RESOLVED",
]);

export const disputes = pgTable("disputes", {
  id: text("id").primaryKey(),
  orderId: text("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  buyerWallet: text("buyer_wallet").notNull(),
  sellerWallet: text("seller_wallet").notNull(),
  status: disputeStatusEnum("status").notNull().default("OPEN"),

  reason: text("reason").notNull(),
  buyerEvidenceCid: text("buyer_evidence_cid"),
  sellerEvidenceCid: text("seller_evidence_cid"),
  frozenAmountToken: numeric("frozen_amount_token", { precision: 36, scale: 18 }),

  // Resolution fields
  resolutionType: text("resolution_type"), // refund | release | split
  resolutionSplitBps: integer("resolution_split_bps"),
  resolutionTxHash: text("resolution_tx_hash"),

  // On-chain reference
  contractDisputeId: text("contract_dispute_id"),

  // Deadlines
  sellerDeadline: timestamp("seller_deadline", { withTimezone: true }),
  reviewDeadline: timestamp("review_deadline", { withTimezone: true }),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Dispute = typeof disputes.$inferSelect;
export type NewDispute = typeof disputes.$inferInsert;
