import type { OrderState, DisputeStatus } from "../config/constants";

export interface Project {
  id: string;
  name: string;
  ownerEmail: string;
  platformFeeWallet: string;
  platformFeeBps: number;
  webhookUrl: string | null;
  webhookSecret: string | null;
  contracts: Record<string, string> | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface ApiKey {
  id: string;
  projectId: string;
  keyHash: string;
  keyPrefix: string;
  label: string | null;
  isActive: boolean;
  lastUsedAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface Seller {
  id: string;
  projectId: string;
  walletAddress: string;
  businessName: string;
  businessAddress: Record<string, unknown>;
  carrierAccounts: Record<string, string> | null;
  payoutConfig: {
    labelCreatedBps: number;
    shippedBps: number;
    deliveredBps: number;
    finalizedBps: number;
  } | null;
  reputationScore: number;
  isActive: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface Order {
  id: string;
  projectId: string;
  sellerId: string;
  buyerWallet: string;
  sellerWallet: string;
  state: OrderState | string;
  shippoShipmentId: string | null;
  selectedRateId: string | null;
  trackingNumber: string | null;
  carrier: string | null;
  labelUrl: string | null;
  labelIpfsCid: string | null;
  shippingCostUsd: string | null;
  addressFrom: Record<string, unknown>;
  addressTo: Record<string, unknown>;
  parcel: Record<string, unknown>;
  subtotalUsd: string;
  totalUsd: string;
  escrowAmountToken: string | null;
  exchangeRate: string | null;
  platformFeeBps: number;
  escrowTxHash: string | null;
  escrowContractOrderId: string | null;
  invoiceIpfsCid: string | null;
  escrowedAt: Date | string | null;
  labelCreatedAt: Date | string | null;
  shippedAt: Date | string | null;
  deliveredAt: Date | string | null;
  finalizedAt: Date | string | null;
  graceEndsAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  externalItemId: string | null;
  name: string;
  quantity: number;
  unitPriceUsd: string;
  weightOz: string | null;
  dimensions: Record<string, unknown> | null;
}

export interface Payout {
  id: string;
  orderId: string;
  sellerId: string;
  state: string;
  amountToken: string;
  percentageBps: number;
  txHash: string | null;
  platformFeeToken: string | null;
  receiptIpfsCid: string | null;
  createdAt: Date | string;
}

export interface Dispute {
  id: string;
  orderId: string;
  buyerWallet: string;
  sellerWallet: string;
  status: DisputeStatus | string;
  reason: string;
  buyerEvidenceCid: string | null;
  sellerEvidenceCid: string | null;
  frozenAmountToken: string | null;
  resolutionType: string | null;
  resolutionSplitBps: number | null;
  resolutionTxHash: string | null;
  contractDisputeId: string | null;
  sellerDeadline: Date | string | null;
  reviewDeadline: Date | string | null;
  resolvedAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface WebhookRegistration {
  id: string;
  projectId: string;
  url: string;
  secret: string;
  events: string[];
  isActive: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface WebhookLog {
  id: string;
  registrationId: string;
  projectId: string;
  eventType: string;
  payload: Record<string, unknown>;
  statusCode: number | null;
  responseBody: string | null;
  attempts: number;
  createdAt: Date | string;
  deliveredAt: Date | string | null;
}