import { db } from "../db/client";
import { webhookRegistrations, webhookLogs } from "../db/schema";
import { eq, desc } from "drizzle-orm";
import { generateId } from "../utils/id-generator";
import { generateWebhookSecret } from "../utils/crypto";
import type { WebhookRegistration, WebhookLog } from "../db/schema";

export interface RegisterWebhookInput {
  url: string;
  events?: string[];
  secret?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export class WebhookMgmtService {
  async register(
    projectId: string,
    input: RegisterWebhookInput
  ): Promise<{ registrationId: string; secret: string; url: string; events: string[] }> {
    const registrationId = generateId.webhookReg();
    const secret = input.secret ?? generateWebhookSecret();
    const events = input.events ?? ["*"];

    await db.insert(webhookRegistrations).values({
      id: registrationId,
      projectId,
      url: input.url,
      secret,
      events,
      isActive: true,
    });

    return { registrationId, secret, url: input.url, events };
  }

  async getLogs(
    projectId: string,
    page: number,
    limit: number
  ): Promise<PaginatedResult<WebhookLog>> {
    const offset = (page - 1) * limit;

    const [data, countResult] = await Promise.all([
      db
        .select()
        .from(webhookLogs)
        .where(eq(webhookLogs.projectId, projectId))
        .orderBy(desc(webhookLogs.createdAt))
        .limit(limit)
        .offset(offset),

      db
        .select({ count: webhookLogs.id })
        .from(webhookLogs)
        .where(eq(webhookLogs.projectId, projectId)),
    ]);

    return { data, total: countResult.length, page, limit };
  }
}
