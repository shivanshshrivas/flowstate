import { createWebhookDeliveryWorker } from "./webhook-delivery.worker";
import {
  createStateTransitionWorker,
  type StateTransitionDeps,
} from "./state-transition.worker";
import {
  createAgentRoutingWorker,
  type AgentRoutingDeps,
} from "./agent-routing.worker";
import type { Worker, ConnectionOptions } from "bullmq";

export interface WorkerDeps extends StateTransitionDeps, AgentRoutingDeps {}

export interface Workers {
  webhookDeliveryWorker: Worker;
  stateTransitionWorker: Worker;
  agentRoutingWorker: Worker;
}

/**
 * Starts all BullMQ workers. Called during bootstrap if Redis is available.
 */
export function startWorkers(
  connection: ConnectionOptions,
  deps: WorkerDeps,
): Workers {
  const webhookDeliveryWorker = createWebhookDeliveryWorker(connection);
  const stateTransitionWorker = createStateTransitionWorker(connection, deps);
  const agentRoutingWorker = createAgentRoutingWorker(connection, deps);

  console.log("[workers] All BullMQ workers started");

  return { webhookDeliveryWorker, stateTransitionWorker, agentRoutingWorker };
}
