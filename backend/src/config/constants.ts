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

export enum DisputeStatus {
  OPEN = "OPEN",
  SELLER_RESPONDED = "SELLER_RESPONDED",
  UNDER_REVIEW = "UNDER_REVIEW",
  RESOLVED_BUYER = "RESOLVED_BUYER",
  RESOLVED_SELLER = "RESOLVED_SELLER",
  RESOLVED_SPLIT = "RESOLVED_SPLIT",
  AUTO_RESOLVED = "AUTO_RESOLVED",
}

// Default payout schedule in basis points (bps) per state transition.
// 1 bps = 0.01%, so 1500 bps = 15%.
// Total seller payout: 15+15+20+35+15 = 100% (platform fee deducted at FINALIZED).
export const PAYOUT_DEFAULTS = {
  LABEL_CREATED_BPS: 1500, // 15% when label is printed
  SHIPPED_BPS: 1500,       // 15% at first carrier scan
  IN_TRANSIT_BPS: 2000,    // 20% at regional sort facility
  DELIVERED_BPS: 3500,     // 35% at confirmed delivery
  FINALIZED_BPS: 1500,     // 15% after grace period (minus platform fee)
} as const;

export const PLATFORM_FEE_BPS_DEFAULT = 250; // 2.5%

export const GRACE_PERIOD_HOURS = 48;
export const SELLER_DISPUTE_DEADLINE_HOURS = 72;
export const REVIEW_DEADLINE_DAYS = 7;

// Valid state transitions for the order FSM.
export const VALID_TRANSITIONS: Record<OrderState, OrderState[]> = {
  [OrderState.INITIATED]: [OrderState.ESCROWED],
  [OrderState.ESCROWED]: [OrderState.LABEL_CREATED, OrderState.DISPUTED],
  [OrderState.LABEL_CREATED]: [OrderState.SHIPPED, OrderState.DISPUTED],
  [OrderState.SHIPPED]: [OrderState.IN_TRANSIT, OrderState.DISPUTED],
  [OrderState.IN_TRANSIT]: [OrderState.DELIVERED, OrderState.DISPUTED],
  [OrderState.DELIVERED]: [OrderState.FINALIZED, OrderState.DISPUTED],
  [OrderState.FINALIZED]: [],
  [OrderState.DISPUTED]: [],
};
