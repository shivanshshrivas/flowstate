import { Worker, type Job, type ConnectionOptions } from "bullmq";
import { db } from "../../db/client";
import type { Order } from "../../db/types";
import { OrderState, GRACE_PERIOD_HOURS } from "../../config/constants";
import { flowStateEmitter } from "../../events/emitter";
import type { IPinataBridge } from "../../bridges/pinata.bridge";
import type { IBlockchainBridge } from "../../bridges/blockchain.bridge";
import type { PayoutService } from "../../services/payout.service";

export interface StateTransitionJobData {
  orderId: string;
  projectId: string;
  targetState: string;
  contractOrderId: string;
  escrowAmountToken: string;
  payoutBps: number;
  sellerId: string;
  trackingNumber?: string;
}

export interface StateTransitionDeps {
  pinataBridge: IPinataBridge;
  blockchainBridge: IBlockchainBridge;
  payoutService: PayoutService;
}

function createProcessor(deps: StateTransitionDeps) {
  return async function processStateTransition(
    job: Job<StateTransitionJobData>,
  ): Promise<void> {
    const {
      orderId,
      projectId,
      targetState,
      contractOrderId,
      escrowAmountToken,
      payoutBps,
      sellerId,
      trackingNumber,
    } = job.data;

    const orderRows = await db<Order[]>`
      select *
      from orders
      where id = ${orderId}
      limit 1
    `;

    const order = orderRows[0];

    if (!order) {
      console.log(`[state-transition] Order ${orderId} not found, skipping`);
      return;
    }

    if (order.state === targetState) {
      console.log(
        `[state-transition] Order ${orderId} already in state ${targetState}, skipping`,
      );
      return;
    }

    const receiptCid = await deps.pinataBridge.pinJSON(
      {
        orderId,
        state: targetState,
        trackingNumber,
        timestamp: new Date().toISOString(),
      },
      `receipt_${targetState.toLowerCase()}_${orderId}`,
    );

    const { txHash: advanceTx } = await deps.blockchainBridge.advanceState(
      contractOrderId,
      targetState,
      receiptCid,
    );

    const { txHash: releaseTx } = await deps.blockchainBridge.releasePartial(
      contractOrderId,
      payoutBps,
    );

    const now = new Date();

    if (targetState === OrderState.SHIPPED) {
      await db`
        update orders
        set
          state = ${targetState},
          shipped_at = ${now},
          updated_at = ${now}
        where id = ${orderId}
      `;
    } else if (targetState === OrderState.DELIVERED) {
      await db`
        update orders
        set
          state = ${targetState},
          delivered_at = ${now},
          grace_ends_at = ${new Date(now.getTime() + GRACE_PERIOD_HOURS * 60 * 60 * 1000)},
          updated_at = ${now}
        where id = ${orderId}
      `;
    } else {
      await db`
        update orders
        set state = ${targetState}, updated_at = ${now}
        where id = ${orderId}
      `;
    }

    await deps.payoutService.recordPayout({
      orderId,
      sellerId,
      state: targetState,
      escrowAmountToken,
      percentageBps: payoutBps,
      txHash: releaseTx,
      receiptIpfsCid: receiptCid,
    });

    flowStateEmitter.emit("order:state_changed", {
      orderId,
      projectId,
      previousState: order.state as OrderState,
      newState: targetState as OrderState,
      txHash: advanceTx,
      timestamp: now,
    });

    console.log(`[state-transition] Order ${orderId} advanced to ${targetState}`);
  };
}

export function createStateTransitionWorker(
  connection: ConnectionOptions,
  deps: StateTransitionDeps,
): Worker<StateTransitionJobData> {
  const worker = new Worker<StateTransitionJobData>(
    "state-transition",
    createProcessor(deps),
    {
      connection,
      concurrency: 5,
    },
  );

  worker.on("completed", (job) => {
    console.log(
      `[state-transition] Job ${job.id} completed for order ${job.data.orderId}`,
    );
  });

  worker.on("failed", (job, error) => {
    console.error(`[state-transition] Job ${job?.id} failed: ${error.message}`);
  });

  return worker;
}

export const STATE_TRANSITION_JOB_OPTS = {
  attempts: 3,
  backoff: {
    type: "exponential" as const,
    delay: 10_000,
  },
  removeOnComplete: { count: 500 },
  removeOnFail: { count: 2000 },
};