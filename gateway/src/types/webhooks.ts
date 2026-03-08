// ─── Webhook event types ──────────────────────────────────────────────────────

export type WebhookEventType =
  | "order.state_changed"
  | "order.status_updated"
  | "payout.released"
  | "dispute.created"
  | "dispute.resolved";

// ─── Per-event payload interfaces ────────────────────────────────────────────

export interface OrderStateChangedPayload {
  order_id: string;
  previous_state: string;
  new_state: string;
  tx_hash?: string;
  timestamp: string;
}

export interface OrderStatusUpdatedPayload {
  orderId: string;
  state: string;
  trackingNumber: string;
  escrowEvent: string;
  txHash?: string;
}

export interface PayoutReleasedPayload {
  payout_id: string;
  order_id: string;
  seller_id: string;
  state: string;
  amount_token: string;
  tx_hash?: string;
}

export interface DisputeCreatedPayload {
  dispute_id: string;
  order_id: string;
  buyer_wallet: string;
  seller_deadline: string;
}

export interface DisputeResolvedPayload {
  dispute_id: string;
  order_id: string;
  resolution: string;
  tx_hash?: string;
}

// ─── Envelope and map ────────────────────────────────────────────────────────

export interface WebhookEnvelope<T = unknown> {
  event: WebhookEventType;
  data: T;
  timestamp: string;
}

export interface WebhookEventMap {
  "order.state_changed": OrderStateChangedPayload;
  "order.status_updated": OrderStatusUpdatedPayload;
  "payout.released": PayoutReleasedPayload;
  "dispute.created": DisputeCreatedPayload;
  "dispute.resolved": DisputeResolvedPayload;
}
