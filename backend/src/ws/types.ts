// ─── Incoming messages from clients ─────────────────────────────────────────

export type WsIncoming = { type: "auth"; token: string } | { type: "ping" };

// ─── Outgoing messages to clients ───────────────────────────────────────────

export type WsOutgoing =
  | { type: "order_state_changed"; data: OrderStateChangedWsData }
  | { type: "escrow_created"; data: EscrowCreatedWsData }
  | { type: "dispute_created"; data: DisputeCreatedWsData }
  | { type: "chat_response"; data: ChatResponseWsData }
  | { type: "payout_released"; data: PayoutReleasedWsData }
  | { type: "pong" }
  | { type: "error"; message: string };

export interface OrderStateChangedWsData {
  orderId: string;
  previousState: string;
  newState: string;
  txHash?: string;
  timestamp: string;
}

export interface EscrowCreatedWsData {
  orderId: string;
  escrowAmountToken: string;
  txHash: string;
}

export interface DisputeCreatedWsData {
  disputeId: string;
  orderId: string;
  buyerWallet: string;
  sellerDeadline: string;
}

export interface ChatResponseWsData {
  role: string;
  userId: string;
  response: string;
  suggestedActions?: string[];
}

export interface PayoutReleasedWsData {
  payoutId: string;
  orderId: string;
  sellerId: string;
  amountToken: string;
  txHash?: string;
}
