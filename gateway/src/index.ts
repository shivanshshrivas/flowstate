"use client";

// Components
export { FlowStateProvider, useFlowState } from "./components/FlowStateProvider";
export type { FlowStateProviderProps } from "./components/FlowStateProvider";

export { PayButton } from "./components/PayButton";
export type { PayButtonProps } from "./components/PayButton";

export { OrderTracker } from "./components/OrderTracker";
export type { OrderTrackerProps } from "./components/OrderTracker";

export { EscrowProgressBar } from "./components/EscrowProgressBar";
export type { EscrowProgressBarProps } from "./components/EscrowProgressBar";

export { BuyerChat } from "./components/BuyerChat";
export type { BuyerChatProps } from "./components/BuyerChat";

export { SellerDashboard } from "./components/SellerDashboard";
export type { SellerDashboardProps } from "./components/SellerDashboard";

export { AdminDashboard } from "./components/AdminDashboard";
export type { AdminDashboardProps } from "./components/AdminDashboard";

export { AgentChat } from "./components/AgentChat";
export type { AgentChatProps } from "./components/AgentChat";

// Client SDK
export { FlowStateApiClient } from "./client/apiClient";
export type { FlowStateApiClientConfig } from "./client/apiClient";

export { FlowStateWsClient } from "./client/wsClient";

// Types (enums exported as values)
export { OrderState, DisputeStatus, ORDER_STATE_LABELS, ORDER_STATE_SEQUENCE } from "./types/index";
export type {
  Order, OrderItem, ShippingOption, ShippingAddress, EscrowDetails,
  PayoutSchedule, StateTransition, Seller, PayoutConfig, SellerMetrics,
  PayoutRecord, Dispute, DisputeEvidence, Resolution, PlatformAnalytics,
  WebhookEvent, FlowStateConfig, FlowStateTheme, UserRole, User,
  ChatMessage, SuggestedAction, AgentResponse,
} from "./types/index";

// Webhook types
export type {
  WebhookEventType, WebhookEventMap, WebhookEnvelope,
  OrderStateChangedPayload, OrderStatusUpdatedPayload,
  PayoutReleasedPayload, DisputeCreatedPayload, DisputeResolvedPayload,
} from "./types/webhooks";

// Contract ABIs
export { EscrowStateMachineAbi } from "./contracts/EscrowStateMachine.abi";
export { FLUSDAbi } from "./contracts/FLUSD.abi";
