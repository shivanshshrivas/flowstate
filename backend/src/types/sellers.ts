export interface BusinessAddress {
  street1: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export interface PayoutConfig {
  labelCreatedBps: number;
  shippedBps: number;
  deliveredBps: number;
  finalizedBps: number;
}

export interface OnboardSellerInput {
  walletAddress: string;
  businessName: string;
  businessAddress: BusinessAddress;
  carrierAccounts?: Record<string, string>;
  payoutConfig?: PayoutConfig;
}

export interface SellerMetrics {
  totalOrders: number;
  totalRevenue: string;
  avgFulfillmentTimeDays: number | null;
  disputeRate: number;
  reputationScore: number;
}

export interface SellerOrdersQuery {
  status?: string;
  page?: number;
  limit?: number;
}
