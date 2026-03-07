import { Shippo } from "shippo";
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

// ─── Escrow event mapping (ported from shippo/src/tracking.js) ────────────────

export function mapToEscrowEvent(
  status: string,
  substatus: string | null
): { escrowEvent: string | null; shouldAdvance: boolean } {
  switch (status) {
    case "PRE_TRANSIT":
      return { escrowEvent: "LABEL_SCANNED", shouldAdvance: false };

    case "TRANSIT":
      if (substatus === "out_for_delivery") {
        return { escrowEvent: "OUT_FOR_DELIVERY", shouldAdvance: false };
      }
      return { escrowEvent: "SHIPPED", shouldAdvance: true };

    case "DELIVERED":
      return { escrowEvent: "DELIVERED", shouldAdvance: true };

    case "RETURNED":
      return { escrowEvent: "RETURN_INITIATED", shouldAdvance: false };

    case "FAILURE":
      return { escrowEvent: "DELIVERY_FAILED", shouldAdvance: false };

    case "UNKNOWN":
    default:
      return { escrowEvent: null, shouldAdvance: false };
  }
}

// ─── Real implementation ──────────────────────────────────────────────────────

export class ShippoBridgeImpl implements IShippoBridge {
  private client: Shippo;

  constructor(apiKey?: string) {
    this.client = new Shippo({ apiKeyHeader: apiKey ?? env.SHIPPO_KEY });
  }

  async getRates(from: Address, to: Address, parcel: Parcel): Promise<GetRatesResult> {
    const shipment = await this.client.shipments.create({
      addressFrom: {
        name: from.name,
        company: from.company,
        street1: from.street1,
        street2: from.street2,
        city: from.city,
        state: from.state,
        zip: from.zip,
        country: from.country,
        phone: from.phone,
        email: from.email,
      },
      addressTo: {
        name: to.name,
        company: to.company,
        street1: to.street1,
        street2: to.street2,
        city: to.city,
        state: to.state,
        zip: to.zip,
        country: to.country,
        phone: to.phone,
        email: to.email,
      },
      parcels: [
        {
          length: String(parcel.length),
          width: String(parcel.width),
          height: String(parcel.height),
          distanceUnit: parcel.distanceUnit,
          weight: String(parcel.weight),
          massUnit: parcel.massUnit,
        },
      ],
      async: false,
    });

    if (shipment.status !== "SUCCESS") {
      throw new Error(`Shipment creation failed: ${shipment.status}`);
    }

    const rates: ShippoRate[] = (shipment.rates ?? []).map((r: any) => ({
      rateId: r.objectId,
      carrier: r.provider,
      service: r.servicelevel?.name ?? "Standard",
      days: r.estimatedDays ?? null,
      amountUSD: r.amount,
      currency: r.currency,
    }));

    return { shipmentId: shipment.objectId, rates };
  }

  async purchaseLabel(rateId: string): Promise<LabelResult> {
    const transaction = await this.client.transactions.create({
      rate: rateId,
      labelFileType: "PDF",
      async: false,
    });

    if (transaction.status !== "SUCCESS") {
      const messages = (transaction.messages ?? []).map((m: any) => m.text).join("; ");
      throw new Error(`Label purchase failed: ${messages || transaction.status}`);
    }

    return {
      transactionId: transaction.objectId ?? "",
      trackingNumber: transaction.trackingNumber ?? "",
      trackingUrlProvider: transaction.trackingUrlProvider ?? "",
      carrier: (transaction.rate as any)?.provider ?? "unknown",
      labelUrl: transaction.labelUrl ?? "",
      shippingCostUsd: (transaction.rate as any)?.amount ?? "0",
    };
  }

  async getTrackingStatus(carrier: string, trackingNumber: string): Promise<TrackingResult> {
    const tracking = await this.client.trackingStatus.get(carrier, trackingNumber);

    const status = (tracking.trackingStatus as any)?.status ?? "UNKNOWN";
    const substatus = (tracking.trackingStatus as any)?.substatus ?? null;

    return {
      carrier,
      trackingNumber,
      status,
      substatus,
      statusDetails: (tracking.trackingStatus as any)?.statusDetails ?? "",
      eta: (tracking as any).eta ?? null,
      history: ((tracking.trackingHistory ?? []) as any[]).map((h) => ({
        status: h.status,
        location: h.location?.city
          ? `${h.location.city}, ${h.location.state}`
          : "Unknown",
        timestamp: h.statusDate,
      })),
      escrowEvent: mapToEscrowEvent(status, substatus),
    };
  }

  async handleWebhook(payload: unknown): Promise<WebhookHandleResult> {
    const body = payload as any;
    const event = body?.event;

    if (event !== "track_updated") {
      return { handled: false, reason: `Ignored event type: ${event}` };
    }

    const data = body?.data;
    const trackingNumber: string = data?.tracking_number;
    const carrier: string = data?.carrier;
    const status: string = data?.tracking_status?.status ?? "UNKNOWN";
    const substatus: string | null = data?.tracking_status?.substatus ?? null;
    const statusDetails: string = data?.tracking_status?.status_details ?? "";

    if (!trackingNumber || !carrier) {
      return { handled: false, reason: "Missing tracking_number or carrier" };
    }

    const { escrowEvent, shouldAdvance } = mapToEscrowEvent(status, substatus);

    return {
      handled: true,
      trackingNumber,
      carrier,
      status,
      substatus,
      statusDetails,
      escrowEvent,
      shouldAdvance,
    };
  }
}
