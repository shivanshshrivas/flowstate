import { Queue, Worker, type Job, type ConnectionOptions } from "bullmq";
import { db } from "../db/client";
import type { Order, Dispute } from "../db/types";
import type { IBlockchainBridge } from "../bridges/blockchain.bridge";
import type { OrderService } from "../services/order.service";

export interface CronDeps {
  orderService: OrderService;
  blockchainBridge: IBlockchainBridge;
}

async function runAutoFinalize(deps: CronDeps): Promise<void> {
  const now = new Date();

  const eligibleOrders = await db<Pick<Order, "id" | "projectId">[]>`
    select id, project_id
    from orders
    where state = ${"DELIVERED"}
      and grace_ends_at < ${now}
  `;

  for (const order of eligibleOrders) {
    const openDisputes = await db<Pick<Dispute, "id">[]>`
      select id
      from disputes
      where order_id = ${order.id}
        and status = ${"OPEN"}
      limit 1
    `;

    if (openDisputes[0]) {
      console.log(
        `[cron:auto-finalize] Skipping order ${order.id} - open dispute exists`,
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

async function runDisputeAutoResolve(deps: CronDeps): Promise<void> {
  const now = new Date();

  const expiredDisputes = await db<Dispute[]>`
    select *
    from disputes
    where status = ${"OPEN"}
      and seller_deadline < ${now}
  `;

  for (const dispute of expiredDisputes) {
    try {
      const orderRows = await db<Order[]>`
        select *
        from orders
        where id = ${dispute.orderId}
        limit 1
      `;

      const order = orderRows[0];
      if (!order?.escrowContractOrderId) {
        console.error(
          `[cron:dispute-auto-resolve] No contract order ID for dispute ${dispute.id}`,
        );
        continue;
      }

      await deps.blockchainBridge.refundBuyer(order.escrowContractOrderId);

      await db`
        update disputes
        set
          status = ${"AUTO_RESOLVED"},
          resolution_type = ${"refund"},
          resolved_at = ${now},
          updated_at = ${now}
        where id = ${dispute.id}
      `;

      console.log(`[cron:dispute-auto-resolve] Auto-resolved dispute ${dispute.id}`);
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

export function startCronJobs(
  connection: ConnectionOptions,
  deps: CronDeps,
): { cronQueue: Queue; cronWorker: Worker } {
  const cronQueue = new Queue("cron", { connection });
  const cronWorker = new Worker("cron", createCronProcessor(deps), {
    connection,
  });

  cronQueue.add(
    "auto-finalize",
    {},
    {
      repeat: { every: 15 * 60 * 1000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 100 },
    },
  );

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

export function startCronFallback(deps: CronDeps): { stop: () => void } {
  const autoFinalizeInterval = setInterval(() => {
    runAutoFinalize(deps).catch((err) => {
      console.error("[cron-fallback:auto-finalize] Error:", err);
    });
  }, 15 * 60 * 1000);

  const disputeAutoResolveInterval = setInterval(() => {
    runDisputeAutoResolve(deps).catch((err) => {
      console.error("[cron-fallback:dispute-auto-resolve] Error:", err);
    });
  }, 30 * 60 * 1000);

  console.log("[cron-fallback] Using setInterval fallback (no Redis)");

  return {
    stop: () => {
      clearInterval(autoFinalizeInterval);
      clearInterval(disputeAutoResolveInterval);
    },
  };
}
