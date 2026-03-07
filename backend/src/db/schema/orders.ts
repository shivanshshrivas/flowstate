import {
  pgTable,
  pgEnum,
  text,
  integer,
  jsonb,
  timestamp,
  numeric,
} from "drizzle-orm/pg-core";
import { projects } from "./projects";
import { sellers } from "./sellers";

export const orderStateEnum = pgEnum("order_state", [
  "INITIATED",
  "ESCROWED",
  "LABEL_CREATED",
  "SHIPPED",
  "IN_TRANSIT",
  "DELIVERED",
  "FINALIZED",
  "DISPUTED",
]);

export const orders = pgTable("orders", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  sellerId: text("seller_id")
    .notNull()
    .references(() => sellers.id),

  buyerWallet: text("buyer_wallet").notNull(),
  sellerWallet: text("seller_wallet").notNull(),
  state: orderStateEnum("state").notNull().default("INITIATED"),

  // Shipping details (populated after select-shipping)
  shippoShipmentId: text("shippo_shipment_id"),
  selectedRateId: text("selected_rate_id"),
  trackingNumber: text("tracking_number"),
  carrier: text("carrier"),
  labelUrl: text("label_url"),
  labelIpfsCid: text("label_ipfs_cid"),
  shippingCostUsd: numeric("shipping_cost_usd", { precision: 10, scale: 2 }),

  // Addresses stored as jsonb
  addressFrom: jsonb("address_from").notNull(),
  addressTo: jsonb("address_to").notNull(),
  parcel: jsonb("parcel").notNull(),

  // Financials
  subtotalUsd: numeric("subtotal_usd", { precision: 10, scale: 2 }).notNull(),
  totalUsd: numeric("total_usd", { precision: 10, scale: 2 }).notNull(),
  escrowAmountToken: numeric("escrow_amount_token", { precision: 36, scale: 18 }),
  exchangeRate: numeric("exchange_rate", { precision: 20, scale: 8 }),
  platformFeeBps: integer("platform_fee_bps").notNull().default(250),

  // On-chain references
  escrowTxHash: text("escrow_tx_hash"),
  escrowContractOrderId: text("escrow_contract_order_id"),

  // IPFS
  invoiceIpfsCid: text("invoice_ipfs_cid"),

  // State transition timestamps
  escrowedAt: timestamp("escrowed_at", { withTimezone: true }),
  labelCreatedAt: timestamp("label_created_at", { withTimezone: true }),
  shippedAt: timestamp("shipped_at", { withTimezone: true }),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  finalizedAt: timestamp("finalized_at", { withTimezone: true }),
  graceEndsAt: timestamp("grace_ends_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
