import { db } from "../db/client";
import type { Order } from "../db/types";
import {
  OrderState,
  PAYOUT_DEFAULTS,
  GRACE_PERIOD_HOURS,
} from "../config/constants";
import { flowStateEmitter } from "../events/emitter";
import type { IShippoBridge } from "../bridges/shippo.bridge";
import type { IPinataBridge } from "../bridges/pinata.bridge";
import type { IBlockchainBridge } from "../bridges/blockchain.bridge";
import type { Address, Parcel, ShippingRate } from "../types/orders";
import type { TrackingResult, WebhookHandleResult } from "../types/shipping";
import { PayoutService } from "./payout.service";
import { WebhookService } from "./webhook.service";
import { getStateTransitionQueue, queuesAvailable } from "../queue/queues";
import { STATE_TRANSITION_JOB_OPTS } from "../queue/workers/state-transition.worker";

export class ShippingService {
  constructor(
    private shippoBridge: IShippoBridge,
    private pinataBridge: IPinataBridge,
    private blockchainBridge: IBlockchainBridge,
    private payoutService: PayoutService,
    private webhookService: WebhookService,
  ) {}

  async getRates(
    from: Address,
    to: Address,
    parcel: Parcel,
  ): Promise<{ shipmentId: string; rates: ShippingRate[] }> {
    return this.shippoBridge.getRates(from, to, parcel);
  }

  async getTracking(orderId: string): Promise<TrackingResult> {
    const orderRows = await db<Order[]>`
      select *
      from orders
      where id = ${orderId}
      limit 1
    `;

    const order = orderRows[0];

    if (!order) {
      const err: any = new Error("Order not found");
      err.statusCode = 404;
      throw err;
    }

    if (!order.carrier || !order.trackingNumber) {
      const err: any = new Error("No tracking information available for this order");
      err.statusCode = 400;
      throw err;
    }

    return this.shippoBridge.getTrackingStatus(order.carrier, order.trackingNumber);
  }

  async processWebhook(payload: unknown): Promise<WebhookHandleResult> {
    const result = await this.shippoBridge.handleWebhook(payload);

    if (!result.handled || !result.shouldAdvance || !result.trackingNumber) {
      return result;
    }

    const orderRows = await db<Order[]>`
      select *
      from orders
      where tracking_number = ${result.trackingNumber}
      limit 1
    `;

    const order = orderRows[0];

    if (!order || !order.escrowContractOrderId) {
      return {
        ...result,
        handled: false,
        reason: "Order not found for tracking number",
      };
    }

    const escrowAmountToken = order.escrowAmountToken ?? "0";
    const contractOrderId = order.escrowContractOrderId;
    const escrowEvent = result.escrowEvent!;

    let newState: OrderState | null = null;
    let payoutBps: number | null = null;

    if (escrowEvent === "SHIPPED" && order.state === OrderState.LABEL_CREATED) {
      newState = OrderState.SHIPPED;
      payoutBps = PAYOUT_DEFAULTS.SHIPPED_BPS;
    } else if (
      escrowEvent === "DELIVERED" &&
      (order.state === OrderState.SHIPPED || order.state === OrderState.IN_TRANSIT)
    ) {
      newState = OrderState.DELIVERED;
      payoutBps = PAYOUT_DEFAULTS.DELIVERED_BPS;
    }

    if (!newState || !payoutBps) {
      return result;
    }

    try {
      const stateQueue = getStateTransitionQueue();
      if (queuesAvailable() && stateQueue) {
        await stateQueue.add(
          `state:${newState}:${order.id}`,
          {
            orderId: order.id,
            projectId: order.projectId,
            targetState: newState,
            contractOrderId,
            escrowAmountToken,
            payoutBps,
            sellerId: order.sellerId,
            trackingNumber: result.trackingNumber,
          },
          STATE_TRANSITION_JOB_OPTS,
        );
      } else {
        const receiptCid = await this.pinataBridge.pinJSON(
          {
            orderId: order.id,
            state: newState,
            trackingNumber: result.trackingNumber,
            timestamp: new Date().toISOString(),
          },
          `receipt_${newState.toLowerCase()}_${order.id}`,
        );

        const { txHash: advanceTx } = await this.blockchainBridge.advanceState(
          contractOrderId,
          newState,
          receiptCid,
        );

        const { txHash: releaseTx } = await this.blockchainBridge.releasePartial(
          contractOrderId,
          payoutBps,
        );

        const now = new Date();
        if (newState === OrderState.SHIPPED) {
          await db`
            update orders
            set
              state = ${newState},
              shipped_at = ${now},
              updated_at = ${now}
            where id = ${order.id}
          `;
        } else if (newState === OrderState.DELIVERED) {
          await db`
            update orders
            set
              state = ${newState},
              delivered_at = ${now},
              grace_ends_at = ${new Date(now.getTime() + GRACE_PERIOD_HOURS * 60 * 60 * 1000)},
              updated_at = ${now}
            where id = ${order.id}
          `;
        } else {
          await db`
            update orders
            set state = ${newState}, updated_at = ${now}
            where id = ${order.id}
          `;
        }

        await this.payoutService.recordPayout({
          orderId: order.id,
          sellerId: order.sellerId,
          state: newState,
          escrowAmountToken,
          percentageBps: payoutBps,
          txHash: releaseTx,
          receiptIpfsCid: receiptCid,
        });

        flowStateEmitter.emit("order:state_changed", {
          orderId: order.id,
          projectId: order.projectId,
          previousState: order.state as OrderState,
          newState,
          txHash: advanceTx,
          timestamp: now,
        });

        await this.webhookService.enqueueDispatch(order.projectId, "order.status_updated", {
          orderId: order.id,
          state: newState,
          trackingNumber: result.trackingNumber,
          escrowEvent,
          txHash: advanceTx,
        });
      }
    } catch (err) {
      console.error("[shipping-service] Failed to advance state from webhook:", err);
    }

    return result;
  }
}