import { pgTable, text, integer, jsonb, timestamp } from "drizzle-orm/pg-core";

export const projects = pgTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  ownerEmail: text("owner_email").notNull(),
  platformFeeWallet: text("platform_fee_wallet").notNull(),
  platformFeeBps: integer("platform_fee_bps").notNull().default(250),
  webhookUrl: text("webhook_url"),
  webhookSecret: text("webhook_secret"),
  // jsonb: { escrow, token, dispute, splitter } contract addresses
  contracts: jsonb("contracts"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
