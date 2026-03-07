import { db } from "../db/client";
import { webhookRegistrations, webhookLogs } from "../db/schema";
import { generateId } from "../utils/id-generator";
import { signWebhook } from "../utils/crypto";
import { eq, and } from "drizzle-orm";
import { getWebhookDeliveryQueue, queuesAvailable } from "../queue/queues";
import { WEBHOOK_DELIVERY_JOB_OPTS } from "../queue/workers/webhook-delivery.worker";

export class WebhookService {
  /**
   * Deliver a webhook to a single registration.
   * Extracted from the dispatch loop for reuse by the BullMQ worker.
   */
  async deliverToRegistration(
    reg: { id: string; url: string; secret: string },
    projectId: string,
    eventType: string,
    payload: unknown,
    body: string,
  ): Promise<{ statusCode?: number; responseBody?: string }> {
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
        deliveredAt:
          statusCode && statusCode >= 200 && statusCode < 300
            ? new Date()
            : undefined,
      })
      .catch(() => {
        /* ignore log failures */
      });

    return { statusCode, responseBody };
  }

  /**
   * Dispatch an event to all active webhook registrations for a project.
   * Runs synchronously (in-process) — used as fallback when Redis is unavailable.
   */
  async dispatch(
    projectId: string,
    eventType: string,
    payload: unknown,
  ): Promise<void> {
    const registrations = await db
      .select()
      .from(webhookRegistrations)
      .where(
        and(
          eq(webhookRegistrations.projectId, projectId),
          eq(webhookRegistrations.isActive, true),
        ),
      );

    const body = JSON.stringify({
      event: eventType,
      data: payload,
      timestamp: new Date().toISOString(),
    });

    for (const reg of registrations) {
      const events = reg.events as string[];
      if (
        events.length > 0 &&
        !events.includes(eventType) &&
        !events.includes("*")
      ) {
        continue;
      }

      await this.deliverToRegistration(
        reg,
        projectId,
        eventType,
        payload,
        body,
      );
    }
  }

  /**
   * Enqueue webhook delivery jobs to BullMQ (one job per registration).
   * Falls back to synchronous dispatch if queues are unavailable.
   */
  async enqueueDispatch(
    projectId: string,
    eventType: string,
    payload: unknown,
  ): Promise<void> {
    if (!queuesAvailable()) {
      return this.dispatch(projectId, eventType, payload);
    }

    const queue = getWebhookDeliveryQueue();
    if (!queue) {
      return this.dispatch(projectId, eventType, payload);
    }

    const registrations = await db
      .select()
      .from(webhookRegistrations)
      .where(
        and(
          eq(webhookRegistrations.projectId, projectId),
          eq(webhookRegistrations.isActive, true),
        ),
      );

    const body = JSON.stringify({
      event: eventType,
      data: payload,
      timestamp: new Date().toISOString(),
    });

    for (const reg of registrations) {
      const events = reg.events as string[];
      if (
        events.length > 0 &&
        !events.includes(eventType) &&
        !events.includes("*")
      ) {
        continue;
      }

      await queue.add(
        `webhook:${eventType}:${reg.id}`,
        {
          registrationId: reg.id,
          projectId,
          eventType,
          payload,
          body,
          secret: reg.secret,
          url: reg.url,
        },
        WEBHOOK_DELIVERY_JOB_OPTS,
      );
    }
  }
}
