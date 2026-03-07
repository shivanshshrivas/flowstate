import { Queue, Worker, type Job, type ConnectionOptions } from "bullmq";
import { db } from "../db/client";
import { orders, disputes } from "../db/schema";
import { eq, and, lt, isNull } from "drizzle-orm";
import { sql } from "drizzle-orm";
import type { IBlockchainBridge } from "../bridges/blockchain.bridge";
import type { OrderService } from "../services/order.service";

// ─── Cron job definitions ───────────────────────────────────────────────────

export interface CronDeps {
  orderService: OrderService;
  blockchainBridge: IBlockchainBridge;
}

/**
 * Auto-finalize: Finds DELIVERED orders whose grace period has expired
 * and that have no open disputes, then finalizes them.
 */
async function runAutoFinalize(deps: CronDeps): Promise<void> {
  const now = new Date();

  // Find orders eligible for auto-finalization
  const eligibleOrders = await db
    .select({ id: orders.id, projectId: orders.projectId })
    .from(orders)
    .where(and(eq(orders.state, "DELIVERED"), lt(orders.graceEndsAt, now)));

  for (const order of eligibleOrders) {
    // Check for open disputes on this order
    const [openDispute] = await db
      .select({ id: disputes.id })
      .from(disputes)
      .where(and(eq(disputes.orderId, order.id), eq(disputes.status, "OPEN")))
      .limit(1);

    if (openDispute) {
      console.log(
        `[cron:auto-finalize] Skipping order ${order.id} — open dispute exists`,
      );
      continue;
    }

    try {
      await deps.orderService.finalize(order.id, order.projectId);
      console.log(`[cron:auto-finalize] Finalized order ${order.id}`);
    } catch (err: any) {
      console.error(
        `[cron:auto-finalize] Failed to finalize order ${order.id}: ${err.message}`,
      );
    }
  }

  console.log(`[cron:auto-finalize] Processed ${eligibleOrders.length} orders`);
}

/**
 * Dispute auto-resolve: Finds OPEN disputes where the seller deadline has passed,
 * and auto-resolves them in favor of the buyer (refund).
 */
async function runDisputeAutoResolve(deps: CronDeps): Promise<void> {
  const now = new Date();

  const expiredDisputes = await db
    .select()
    .from(disputes)
    .where(and(eq(disputes.status, "OPEN"), lt(disputes.sellerDeadline, now)));

  for (const dispute of expiredDisputes) {
    try {
      // Look up the order to get contractOrderId
      const [order] = await db
        .select()
        .from(orders)
        .where(eq(orders.id, dispute.orderId))
        .limit(1);

      if (!order?.escrowContractOrderId) {
        console.error(
          `[cron:dispute-auto-resolve] No contract order ID for dispute ${dispute.id}`,
        );
        continue;
      }

      await deps.blockchainBridge.refundBuyer(order.escrowContractOrderId);

      await db
        .update(disputes)
        .set({
          status: "AUTO_RESOLVED",
          resolutionType: "refund",
          resolvedAt: now,
          updatedAt: now,
        })
        .where(eq(disputes.id, dispute.id));

      console.log(
        `[cron:dispute-auto-resolve] Auto-resolved dispute ${dispute.id}`,
      );
    } catch (err: any) {
      console.error(
        `[cron:dispute-auto-resolve] Failed to auto-resolve dispute ${dispute.id}: ${err.message}`,
      );
    }
  }

  console.log(
    `[cron:dispute-auto-resolve] Processed ${expiredDisputes.length} disputes`,
  );
}

// ─── BullMQ cron worker ─────────────────────────────────────────────────────

function createCronProcessor(deps: CronDeps) {
  return async function processCronJob(job: Job): Promise<void> {
    switch (job.name) {
      case "auto-finalize":
        await runAutoFinalize(deps);
        break;
      case "dispute-auto-resolve":
        await runDisputeAutoResolve(deps);
        break;
      default:
        console.warn(`[cron] Unknown cron job: ${job.name}`);
    }
  };
}

/**
 * Start cron jobs using BullMQ repeatable jobs (when Redis is available).
 */
export function startCronJobs(
  connection: ConnectionOptions,
  deps: CronDeps,
): { cronQueue: Queue; cronWorker: Worker } {
  const cronQueue = new Queue("cron", { connection });
  const cronWorker = new Worker("cron", createCronProcessor(deps), {
    connection,
  });

  // Auto-finalize: every 15 minutes
  cronQueue.add(
    "auto-finalize",
    {},
    {
      repeat: { every: 15 * 60 * 1000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 100 },
    },
  );

  // Dispute auto-resolve: every 30 minutes
  cronQueue.add(
    "dispute-auto-resolve",
    {},
    {
      repeat: { every: 30 * 60 * 1000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 100 },
    },
  );

  cronWorker.on("completed", (job) => {
    console.log(`[cron] Job ${job.name} completed`);
  });

  cronWorker.on("failed", (job, error) => {
    console.error(`[cron] Job ${job?.name} failed: ${error.message}`);
  });

  console.log(
    "[cron] Cron jobs started (auto-finalize: 15min, dispute-auto-resolve: 30min)",
  );

  return { cronQueue, cronWorker };
}

// ─── setInterval fallback (no Redis) ────────────────────────────────────────

export function startCronFallback(deps: CronDeps): { stop: () => void } {
  const autoFinalizeInterval = setInterval(
    () => {
      runAutoFinalize(deps).catch((err) => {
        console.error("[cron-fallback:auto-finalize] Error:", err);
      });
    },
    15 * 60 * 1000,
  );

  const disputeAutoResolveInterval = setInterval(
    () => {
      runDisputeAutoResolve(deps).catch((err) => {
        console.error("[cron-fallback:dispute-auto-resolve] Error:", err);
      });
    },
    30 * 60 * 1000,
  );

  console.log("[cron-fallback] Using setInterval fallback (no Redis)");

  return {
    stop: () => {
      clearInterval(autoFinalizeInterval);
      clearInterval(disputeAutoResolveInterval);
    },
  };
}
