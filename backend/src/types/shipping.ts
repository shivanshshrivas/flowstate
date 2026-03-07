export interface TrackingHistoryEntry {
  status: string;
  location: string;
  timestamp: string;
}

export interface EscrowEvent {
  escrowEvent: string | null;
  shouldAdvance: boolean;
}

export interface TrackingResult {
  carrier: string;
  trackingNumber: string;
  status: string;
  substatus: string | null;
  statusDetails: string;
  eta: string | null;
  history: TrackingHistoryEntry[];
  escrowEvent: EscrowEvent;
}

export interface GetRatesQuery {
  from: string; // JSON-encoded Address
  to: string;   // JSON-encoded Address
  parcel: string; // JSON-encoded Parcel
}

export interface ShippoWebhookPayload {
  event: string;
  data: {
    tracking_number: string;
    carrier: string;
    tracking_status: {
      status: string;
      substatus: string | null;
      status_details: string;
    };
    [key: string]: unknown;
  };
}

export interface WebhookHandleResult {
  handled: boolean;
  reason?: string;
  trackingNumber?: string;
  carrier?: string;
  status?: string;
  substatus?: string | null;
  statusDetails?: string;
  escrowEvent?: string | null;
  shouldAdvance?: boolean;
}
