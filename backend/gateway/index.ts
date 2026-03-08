// ─── Client Components ────────────────────────────────────────────────────
export { FlowStateProvider, useFlowState } from "./FlowStateProvider";
export type { FlowStateProviderProps } from "./FlowStateProvider";

export { EscrowProgressBar } from "./EscrowProgressBar";
export type { EscrowProgressBarProps } from "./EscrowProgressBar";

export { OrderTracker } from "./OrderTracker";
export type { OrderTrackerProps } from "./OrderTracker";

export { AgentChat } from "./AgentChat";
export type { AgentChatProps } from "./AgentChat";

export { BuyerChat } from "./BuyerChat";
export type { BuyerChatProps } from "./BuyerChat";

export { SellerDashboard } from "./SellerDashboard";
export type { SellerDashboardProps } from "./SellerDashboard";

export { AdminDashboard } from "./AdminDashboard";
export type { AdminDashboardProps } from "./AdminDashboard";

export { PayButton } from "./PayButton";
export type { PayButtonProps } from "./PayButton";

// ─── Legacy / Low-level ───────────────────────────────────────────────────
export { FlowStateCheckoutButton } from "./FlowStateCheckoutButton";
export type { FlowStateCheckoutButtonProps } from "./FlowStateCheckoutButton";

// ─── Server SDK ───────────────────────────────────────────────────────────
export { FlowStateServer, verifyWebhookSignature } from "./server";
export type { FlowStateServerConfig } from "./server";

// ─── API + WS Clients ─────────────────────────────────────────────────────
export { FlowStateApiClient } from "./apiClient";
export type { FlowStateApiClientConfig } from "./apiClient";

export { FlowStateWsClient } from "./wsClient";

// ─── Types ────────────────────────────────────────────────────────────────
// Enums must be exported as values (not type-only)
export { OrderState, DisputeStatus, ORDER_STATE_LABELS, ORDER_STATE_SEQUENCE } from "./types/index";

export type {
  Order,
  OrderItem,
  ShippingOption,
  ShippingAddress,
  EscrowDetails,
  PayoutSchedule,
  StateTransition,
  Seller,
  PayoutConfig,
  SellerMetrics,
  PayoutRecord,
  Dispute,
  DisputeEvidence,
  Resolution,
  PlatformAnalytics,
  WebhookEvent,
  FlowStateConfig,
  FlowStateTheme,
  UserRole,
  User,
  ChatMessage,
  SuggestedAction,
  AgentResponse,
} from "./types/index";

// ─── Webhook Types ────────────────────────────────────────────────────────
export type {
  WebhookEventType,
  WebhookEventMap,
  WebhookEnvelope,
  OrderStateChangedPayload,
  OrderStatusUpdatedPayload,
  PayoutReleasedPayload,
  DisputeCreatedPayload,
  DisputeResolvedPayload,
} from "./types/webhooks";
