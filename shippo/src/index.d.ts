export function initialize(apiKey: string): void;

export function getShippingRates(
  fromAddress: Record<string, any>,
  toAddress: Record<string, any>,
  parcel: Record<string, any>,
): Promise<{
  shipmentId: string;
  rates: Array<{
    rateId: string;
    carrier: string;
    service: string;
    days: number | null;
    amountUSD: string;
    currency: string;
  }>;
}>;

export function purchaseLabel(rateObjectId: string): Promise<{
  transactionId: string;
  trackingNumber: string;
  trackingUrlProvider: string;
  carrier: string;
  labelUrl: string;
  labelIpfsCid: string | null;
  shippingCostUsd: string;
}>;

export function pinLabelToIPFS(labelUrl: string, orderId: string): Promise<string>;

export function getTrackingStatus(
  carrier: string,
  trackingNumber: string,
): Promise<{
  carrier: string;
  trackingNumber: string;
  status: string;
  substatus: string | null;
  statusDetails: string;
  eta: string | null;
  history: Array<{ status: string; location: string; timestamp: string }>;
  escrowEvent: { escrowEvent: string | null; shouldAdvance: boolean };
}>;

export function mapToEscrowEvent(
  status: string,
  substatus: string | null,
): { escrowEvent: string | null; shouldAdvance: boolean };

export function handleShippoWebhook(payload: unknown): Promise<{
  handled: boolean;
  reason?: string;
  trackingNumber?: string;
  carrier?: string;
  status?: string;
  substatus?: string | null;
  statusDetails?: string;
  escrowEvent?: string | null;
  shouldAdvance?: boolean;
}>;
