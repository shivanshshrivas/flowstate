import { pgTable, text, integer, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { projects } from "./projects";

export const sellers = pgTable("sellers", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  walletAddress: text("wallet_address").notNull(),
  businessName: text("business_name").notNull(),
  // jsonb: { street1, street2, city, state, zip, country }
  businessAddress: jsonb("business_address").notNull(),
  // jsonb: { usps: "account_id", fedex: "account_id", ... }
  carrierAccounts: jsonb("carrier_accounts"),
  // jsonb: { labelCreatedBps, shippedBps, deliveredBps, finalizedBps }
  payoutConfig: jsonb("payout_config"),
  reputationScore: integer("reputation_score").notNull().default(100),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Seller = typeof sellers.$inferSelect;
export type NewSeller = typeof sellers.$inferInsert;
