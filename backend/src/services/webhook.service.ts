import { db } from "../db/client";
import { webhookRegistrations, webhookLogs } from "../db/schema";
import { generateId } from "../utils/id-generator";
import { signWebhook } from "../utils/crypto";
import { eq, and } from "drizzle-orm";

export class WebhookService {
  /**
   * Dispatch an event to all active webhook registrations for a project.
   * Signs payload with HMAC-SHA256 and attaches as X-FlowState-Signature header.
   */
  async dispatch(
    projectId: string,
    eventType: string,
    payload: unknown
  ): Promise<void> {
    const registrations = await db
      .select()
      .from(webhookRegistrations)
      .where(
        and(
          eq(webhookRegistrations.projectId, projectId),
          eq(webhookRegistrations.isActive, true)
        )
      );

    const body = JSON.stringify({ event: eventType, data: payload, timestamp: new Date().toISOString() });

    for (const reg of registrations) {
      const events = reg.events as string[];
      if (events.length > 0 && !events.includes(eventType) && !events.includes("*")) {
        continue;
      }

      const signature = signWebhook(body, reg.secret);
      let statusCode: number | undefined;
      let responseBody: string | undefined;

      try {
        const res = await fetch(reg.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-FlowState-Signature": `sha256=${signature}`,
            "X-FlowState-Event": eventType,
          },
          body,
          signal: AbortSignal.timeout(10_000),
        });
        statusCode = res.status;
        responseBody = await res.text().catch(() => "");
      } catch (err: any) {
        statusCode = 0;
        responseBody = err?.message ?? "Network error";
      }

      // Log the attempt (fire-and-forget)
      db.insert(webhookLogs)
        .values({
          id: generateId.webhookLog(),
          registrationId: reg.id,
          projectId,
          eventType,
          payload: payload as Record<string, unknown>,
          statusCode,
          responseBody,
          deliveredAt: statusCode && statusCode >= 200 && statusCode < 300 ? new Date() : undefined,
        })
        .catch(() => {/* ignore log failures */});
    }
  }
}
