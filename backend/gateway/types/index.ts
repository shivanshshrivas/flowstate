// ─── Order State Machine ───────────────────────────────────────────────────

export enum OrderState {
  INITIATED = "INITIATED",
  ESCROWED = "ESCROWED",
  LABEL_CREATED = "LABEL_CREATED",
  SHIPPED = "SHIPPED",
  IN_TRANSIT = "IN_TRANSIT",
  DELIVERED = "DELIVERED",
  FINALIZED = "FINALIZED",
  DISPUTED = "DISPUTED",
}

export const ORDER_STATE_LABELS: Record<OrderState, string> = {
  [OrderState.INITIATED]: "Order Placed",
  [OrderState.ESCROWED]: "Payment Escrowed",
  [OrderState.LABEL_CREATED]: "Label Printed",
  [OrderState.SHIPPED]: "Shipped",
  [OrderState.IN_TRANSIT]: "In Transit",
  [OrderState.DELIVERED]: "Delivered",
  [OrderState.FINALIZED]: "Finalized",
  [OrderState.DISPUTED]: "Disputed",
};

export const ORDER_STATE_SEQUENCE: OrderState[] = [
  OrderState.INITIATED,
  OrderState.ESCROWED,
  OrderState.LABEL_CREATED,
  OrderState.SHIPPED,
  OrderState.IN_TRANSIT,
  OrderState.DELIVERED,
  OrderState.FINALIZED,
];

// ─── Payout Schedule ──────────────────────────────────────────────────────

export interface PayoutSchedule {
  state: OrderState;
  percentageBps: number;
  label: string;
  releasedAt?: string;
  txHash?: string;
  amountToken?: string;
}

// ─── Shipping ─────────────────────────────────────────────────────────────

export interface ShippingOption {
  id: string;
  carrier: string;
  service: string;
  price_usd: number;
  estimated_days: number;
  logo?: string;
}

export interface ShippingAddress {
  name: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

// ─── Escrow ───────────────────────────────────────────────────────────────

export interface EscrowDetails {
  escrowId: string;
  contractAddress: string;
  tokenAddress: string;
  totalAmount: string;
  remainingAmount: string;
  txHash: string;
  blockNumber: number;
  createdAt: string;
}

// ─── Orders ───────────────────────────────────────────────────────────────

export interface OrderItem {
  product_id: string;
  product_name: string;
  quantity: number;
  price_usd: number;
  image_url?: string;
}

export interface Order {
  id: string;
  buyer_wallet: string;
  seller_id: string;
  seller_name?: string;
  items: OrderItem[];
  state: OrderState;
  total_usd: number;
  total_token: string;
  shipping_option?: ShippingOption;
  shipping_address?: ShippingAddress;
  escrow?: EscrowDetails;
  payout_schedule: PayoutSchedule[];
  tracking_number?: string;
  carrier?: string;
  label_url?: string;
  created_at: string;
  updated_at: string;
  state_history: StateTransition[];
}

export interface StateTransition {
  from: OrderState;
  to: OrderState;
  timestamp: string;
  txHash?: string;
  triggeredBy: "buyer" | "seller" | "system" | "oracle";
  notes?: string;
}

// ─── Sellers ──────────────────────────────────────────────────────────────

export interface Seller {
  id: string;
  business_name: string;
  wallet_address: string;
  email: string;
  address: ShippingAddress;
  payout_config: PayoutConfig;
  status: "pending" | "active" | "suspended";
  created_at: string;
}

export interface PayoutConfig {
  immediate_bps: number;
  milestone_bps: number;
  holdback_bps: number;
}

export interface SellerMetrics {
  total_orders: number;
  total_revenue_usd: number;
  total_revenue_token: string;
  fulfillment_avg_hours: number;
  dispute_rate: number;
  active_escrows: number;
  pending_payouts_token: string;
}

export interface PayoutRecord {
  id: string;
  order_id: string;
  state: OrderState;
  amount_token: string;
  amount_usd: number;
  tx_hash: string;
  timestamp: string;
}

// ─── Disputes ─────────────────────────────────────────────────────────────

export enum DisputeStatus {
  OPEN = "OPEN",
  SELLER_RESPONDED = "SELLER_RESPONDED",
  RESOLVED = "RESOLVED",
  AUTO_RESOLVED = "AUTO_RESOLVED",
}

export interface DisputeEvidence {
  description: string;
  ipfs_cid?: string;
  file_urls?: string[];
  submitted_at: string;
}

export interface Resolution {
  outcome: "refund_buyer" | "release_seller" | "partial";
  refund_bps?: number;
  resolved_by: "admin" | "auto" | "agreement";
  resolved_at: string;
  notes?: string;
}

export interface Dispute {
  id: string;
  order_id: string;
  buyer_wallet: string;
  seller_id: string;
  status: DisputeStatus;
  buyer_evidence: DisputeEvidence;
  seller_evidence?: DisputeEvidence;
  resolution?: Resolution;
  deadline: string;
  created_at: string;
}

// ─── Platform / Admin ─────────────────────────────────────────────────────

export interface PlatformAnalytics {
  total_orders: number;
  total_volume_usd: number;
  active_escrows: number;
  dispute_rate: number;
  avg_resolution_hours: number;
  orders_by_day: { date: string; count: number; volume_usd: number }[];
}

export interface WebhookEvent {
  id: string;
  event_type: string;
  source: "shippo" | "contract" | "manual";
  order_id?: string;
  payload: Record<string, unknown>;
  status: "received" | "processed" | "failed";
  http_status?: number;
  timestamp: string;
}

// ─── Gateway Config ───────────────────────────────────────────────────────

export interface FlowStateConfig {
  projectId: string;
  apiKey: string;
  baseUrl?: string;
  network: "testnet" | "mainnet";
  theme?: FlowStateTheme;
  contracts?: {
    escrowStateMachine?: `0x${string}`;
    disputeResolver?: `0x${string}`;
    paymentSplitter?: `0x${string}`;
    mockRLUSD?: `0x${string}`;
  };
}

export interface FlowStateTheme {
  primaryColor?: string;
  borderRadius?: "none" | "sm" | "md" | "lg";
  fontFamily?: string;
}

// ─── Users ────────────────────────────────────────────────────────────────

export type UserRole = "buyer" | "seller" | "admin";

export interface User {
  id: string;
  email: string;
  role: UserRole;
  wallet_address?: string;
  seller_id?: string;
}

// ─── Agent Chat ───────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface SuggestedAction {
  label: string;
  action: string;
  payload?: Record<string, unknown>;
}

export interface AgentResponse {
  message: string;
  suggested_actions?: SuggestedAction[];
}
