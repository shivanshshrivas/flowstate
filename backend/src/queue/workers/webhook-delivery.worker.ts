import { Worker, type Job, type ConnectionOptions } from "bullmq";
import { db } from "../../db/client";
import { webhookLogs } from "../../db/schema";
import { generateId } from "../../utils/id-generator";
import { signWebhook } from "../../utils/crypto";

export interface WebhookDeliveryJobData {
  registrationId: string;
  projectId: string;
  eventType: string;
  payload: unknown;
  body: string;
  secret: string;
  url: string;
}

async function processWebhookDelivery(
  job: Job<WebhookDeliveryJobData>,
): Promise<void> {
  const { registrationId, projectId, eventType, payload, body, secret, url } =
    job.data;

  const signature = signWebhook(body, secret);
  let statusCode: number | undefined;
  let responseBody: string | undefined;

  try {
    const res = await fetch(url, {
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
    throw err; // Re-throw so BullMQ retries
  } finally {
    // Log the delivery attempt
    db.insert(webhookLogs)
      .values({
        id: generateId.webhookLog(),
        registrationId,
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
  }

  if (statusCode && (statusCode < 200 || statusCode >= 300)) {
    throw new Error(`Webhook delivery failed with status ${statusCode}`);
  }
}

export function createWebhookDeliveryWorker(
  connection: ConnectionOptions,
): Worker<WebhookDeliveryJobData> {
  const worker = new Worker<WebhookDeliveryJobData>(
    "webhook-delivery",
    processWebhookDelivery,
    {
      connection,
      concurrency: 10,
      limiter: { max: 100, duration: 60_000 },
    },
  );

  worker.on("completed", (job) => {
    console.log(
      `[webhook-delivery] Job ${job.id} completed for ${job.data.url}`,
    );
  });

  worker.on("failed", (job, error) => {
    console.error(`[webhook-delivery] Job ${job?.id} failed: ${error.message}`);
  });

  return worker;
}

// Default job options for webhook delivery
export const WEBHOOK_DELIVERY_JOB_OPTS = {
  attempts: 5,
  backoff: {
    type: "exponential" as const,
    delay: 5000,
  },
  removeOnComplete: { count: 1000 },
  removeOnFail: { count: 5000 },
};
