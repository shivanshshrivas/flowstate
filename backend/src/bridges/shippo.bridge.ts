import * as shippoLib from "../../../shippo/src";

import type { Address, Parcel } from "../types/orders";
import type { TrackingResult, WebhookHandleResult } from "../types/shipping";
import { env } from "../config/env";

// ─── Rate shape returned from Shippo ─────────────────────────────────────────

export interface ShippoRate {
  rateId: string;
  carrier: string;
  service: string;
  days: number | null;
  amountUSD: string;
  currency: string;
}

export interface GetRatesResult {
  shipmentId: string;
  rates: ShippoRate[];
}

export interface LabelResult {
  transactionId: string;
  trackingNumber: string;
  trackingUrlProvider: string;
  carrier: string;
  labelUrl: string;
  shippingCostUsd: string;
}

// ─── Interface ────────────────────────────────────────────────────────────────

export interface IShippoBridge {
  getRates(from: Address, to: Address, parcel: Parcel): Promise<GetRatesResult>;
  purchaseLabel(rateId: string): Promise<LabelResult>;
  getTrackingStatus(carrier: string, trackingNumber: string): Promise<TrackingResult>;
  handleWebhook(payload: unknown): Promise<WebhookHandleResult>;
}

// ─── Escrow event mapping: delegate to shippo module ─────────────────────────

export function mapToEscrowEvent(
  status: string,
  substatus: string | null
): { escrowEvent: string | null; shouldAdvance: boolean } {
  return shippoLib.mapToEscrowEvent(status, substatus);
}

// ─── Bridge implementation: delegate all methods ──────────────────────────────

export class ShippoBridgeImpl implements IShippoBridge {
  constructor(apiKey?: string) {
    shippoLib.initialize(apiKey ?? env.SHIPPO_KEY);
  }

  async getRates(from: Address, to: Address, parcel: Parcel): Promise<GetRatesResult> {
    return shippoLib.getShippingRates(from, to, parcel);
  }

  async purchaseLabel(rateId: string): Promise<LabelResult> {
    return shippoLib.purchaseLabel(rateId);
  }

  async getTrackingStatus(carrier: string, trackingNumber: string): Promise<TrackingResult> {
    return shippoLib.getTrackingStatus(carrier, trackingNumber);
  }

  async handleWebhook(payload: unknown): Promise<WebhookHandleResult> {
    return shippoLib.handleShippoWebhook(payload);
  }
}
