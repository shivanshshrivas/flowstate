import { Queue, type ConnectionOptions } from "bullmq";
import { getRedisConnection } from "./redis";

let webhookDeliveryQueue: Queue | null = null;
let stateTransitionQueue: Queue | null = null;
let agentRoutingQueue: Queue | null = null;

/**
 * Returns true if Redis is available and queues have been initialized.
 */
export function queuesAvailable(): boolean {
  return webhookDeliveryQueue !== null;
}

/**
 * Initializes BullMQ queues. Only called if Redis is available.
 */
export function initializeQueues(): {
  webhookDeliveryQueue: Queue;
  stateTransitionQueue: Queue;
  agentRoutingQueue: Queue;
} | null {
  const connection = getRedisConnection();
  if (!connection) return null;

  const conn = connection as unknown as ConnectionOptions;
  webhookDeliveryQueue = new Queue("webhook-delivery", { connection: conn });
  stateTransitionQueue = new Queue("state-transition", { connection: conn });
  agentRoutingQueue = new Queue("agent-routing", { connection: conn });

  console.log(
    "[queues] BullMQ queues initialized: webhook-delivery, state-transition, agent-routing",
  );

  return { webhookDeliveryQueue, stateTransitionQueue, agentRoutingQueue };
}

export function getWebhookDeliveryQueue(): Queue | null {
  return webhookDeliveryQueue;
}

export function getStateTransitionQueue(): Queue | null {
  return stateTransitionQueue;
}

export function getAgentRoutingQueue(): Queue | null {
  return agentRoutingQueue;
}
