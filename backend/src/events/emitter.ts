import { EventEmitter } from "events";
import type { OrderState, DisputeStatus } from "../config/constants";

// ─── Event payload types ──────────────────────────────────────────────────────

export interface OrderStateChangedEvent {
  orderId: string;
  projectId: string;
  previousState: OrderState;
  newState: OrderState;
  txHash?: string;
  timestamp: Date;
}

export interface DisputeCreatedEvent {
  disputeId: string;
  orderId: string;
  projectId: string;
  buyerWallet: string;
  sellerDeadline: Date;
}

export interface DisputeResolvedEvent {
  disputeId: string;
  orderId: string;
  projectId: string;
  resolution: string;
  txHash?: string;
}

export interface PayoutRecordedEvent {
  payoutId: string;
  orderId: string;
  sellerId: string;
  projectId?: string;
  state: string;
  amountToken: string;
  txHash?: string;
}

// ─── Typed event map ──────────────────────────────────────────────────────────

interface FlowStateEvents {
  "order:state_changed": [OrderStateChangedEvent];
  "dispute:created": [DisputeCreatedEvent];
  "dispute:resolved": [DisputeResolvedEvent];
  "payout:recorded": [PayoutRecordedEvent];
}

// ─── Emitter singleton ────────────────────────────────────────────────────────

class FlowStateEmitter extends EventEmitter {
  emit<K extends keyof FlowStateEvents>(
    event: K,
    ...args: FlowStateEvents[K]
  ): boolean {
    return super.emit(event as string, ...args);
  }

  on<K extends keyof FlowStateEvents>(
    event: K,
    listener: (...args: FlowStateEvents[K]) => void
  ): this {
    return super.on(event as string, listener as (...args: any[]) => void);
  }

  once<K extends keyof FlowStateEvents>(
    event: K,
    listener: (...args: FlowStateEvents[K]) => void
  ): this {
    return super.once(event as string, listener as (...args: any[]) => void);
  }
}

export const flowStateEmitter = new FlowStateEmitter();
flowStateEmitter.setMaxListeners(50);
