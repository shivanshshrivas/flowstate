import { pgTable, text, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { projects } from "./projects";

export const webhookRegistrations = pgTable("webhook_registrations", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  secret: text("secret").notNull(),
  // jsonb array of event types: ["order.created", "order.escrowed", ...]
  events: jsonb("events").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type WebhookRegistration = typeof webhookRegistrations.$inferSelect;
export type NewWebhookRegistration = typeof webhookRegistrations.$inferInsert;
