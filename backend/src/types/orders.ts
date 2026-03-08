import type { OrderState } from "../config/constants";

export interface Address {
  name: string;
  company?: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  phone?: string;
  email?: string;
}

export interface Parcel {
  length: number;
  width: number;
  height: number;
  distanceUnit: "cm" | "in";
  weight: number;
  massUnit: "g" | "kg" | "lb" | "oz";
}

export interface OrderItem {
  externalItemId?: string;
  name: string;
  quantity: number;
  unitPriceUsd: number;
  weightOz?: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
    unit: string;
  };
}

export interface CreateOrderInput {
  items: OrderItem[];
  sellerId: string;
  buyerWallet: string;
  sellerWallet: string;
  addressFrom: Address;
  addressTo: Address;
  parcel: Parcel;
}

export interface SelectShippingInput {
  rateId: string;
}

export interface ConfirmEscrowInput {
  txHash: string;
}

export interface ConfirmLabelPrintedInput {
  sellerWallet: string;
}

export interface ShippingRate {
  rateId: string;
  carrier: string;
  service: string;
  days: number | null;
  amountUSD: string;
  currency: string;
}

export interface PayoutSchedule {
  labelCreatedBps: number;
  shippedBps: number;
  inTransitBps: number;
  deliveredBps: number;
  finalizedBps: number;
}

export interface OrderSummary {
  id: string;
  state: OrderState;
  buyerWallet: string;
  sellerWallet: string;
  totalUsd: string;
  escrowAmountToken: string | null;
  trackingNumber: string | null;
  carrier: string | null;
  createdAt: Date;
  updatedAt: Date;
}
