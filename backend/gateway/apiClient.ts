import type {
  Order,
  ShippingOption,
  PayoutSchedule,
  SellerMetrics,
  PayoutRecord,
  Seller,
  Dispute,
  PlatformAnalytics,
  WebhookEvent,
  AgentResponse,
} from "./types/index";

export interface FlowStateApiClientConfig {
  baseUrl: string;
  apiKey: string;
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  error?: { code: string; message: string };
}

export class FlowStateApiClient {
  private baseUrl: string;
  private apiKey: string;

  constructor({ baseUrl, apiKey }: FlowStateApiClientConfig) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.apiKey = apiKey;
  }

  private async request<T>(
    method: "GET" | "POST" | "PUT" | "DELETE",
    path: string,
    body?: unknown,
  ): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const json: ApiEnvelope<T> = await res.json();

    if (!res.ok || !json.success) {
      throw new Error(
        json.error?.message ??
          `FlowState API error ${res.status} on ${method} ${path}`,
      );
    }

    return json.data;
  }

  // ─── Orders ─────────────────────────────────────────────────────────────

  async createOrder(input: {
    seller_id: string;
    buyer_wallet: string;
    seller_wallet: string;
    address_from: {
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
    };
    address_to: {
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
    };
    parcel: {
      length: number;
      width: number;
      height: number;
      distanceUnit: "cm" | "in";
      weight: number;
      massUnit: "g" | "kg" | "lb" | "oz";
    };
    items: Array<{
      externalItemId?: string;
      name: string;
      quantity: number;
      unitPriceUsd: number;
      weightOz?: number;
    }>;
  }): Promise<{
    order_id: string;
    shipping_options: ShippingOption[];
    escrow_address: string;
    subtotal_usd: number;
  }> {
    return this.request("POST", "/api/v1/orders/create", input);
  }

  async selectShipping(
    orderId: string,
    input: { rate_id: string },
  ): Promise<{
    escrow_amount_token: string;
    exchange_rate: number;
    label_cid: string;
    total_usd: number;
    shipping_cost_usd: number;
  }> {
    return this.request("POST", `/api/v1/orders/${orderId}/select-shipping`, input);
  }

  async confirmEscrow(
    orderId: string,
    input: { tx_hash: string },
  ): Promise<{
    status: string;
    invoice_cid: string;
    payout_schedule: PayoutSchedule[];
  }> {
    return this.request("POST", `/api/v1/orders/${orderId}/confirm-escrow`, input);
  }

  async confirmLabelPrinted(
    orderId: string,
    input: { seller_wallet: string },
  ): Promise<{
    status: string;
    payout_amount_token: string;
    tx_hash: string;
  }> {
    return this.request(
      "POST",
      `/api/v1/orders/${orderId}/confirm-label-printed`,
      input,
    );
  }

  async finalizeOrder(orderId: string): Promise<{
    status: string;
    final_payout_token: string;
    platform_fee_token: string;
    tx_hash: string;
  }> {
    return this.request("POST", `/api/v1/orders/${orderId}/finalize`);
  }

  async getOrder(orderId: string): Promise<{ order: Order; items: Order["items"] }> {
    return this.request("GET", `/api/v1/orders/${orderId}`);
  }

  async listOrders(filters?: {
    buyer_wallet?: string;
    seller_id?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ orders: Order[]; total: number }> {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([k, v]) => {
        if (v !== undefined) params.set(k, String(v));
      });
    }
    const qs = params.toString() ? `?${params.toString()}` : "";
    return this.request("GET", `/api/v1/orders${qs}`);
  }

  // ─── Shipping ─────────────────────────────────────────────────────────────

  async getShippingRates(params: {
    address_from: Record<string, string>;
    address_to: Record<string, string>;
    parcel: Record<string, unknown>;
  }): Promise<{ rates: ShippingOption[] }> {
    return this.request("GET", `/api/v1/shipping/rates`);
  }

  async trackShipment(orderId: string): Promise<{
    tracking_number: string;
    carrier: string;
    status: string;
    events: Array<{ timestamp: string; description: string; location: string }>;
  }> {
    return this.request("GET", `/api/v1/shipping/track/${orderId}`);
  }

  // ─── Sellers ─────────────────────────────────────────────────────────────

  async onboardSeller(input: {
    business_name: string;
    wallet_address: string;
    email: string;
    address: Record<string, string>;
    payout_config?: Record<string, number>;
  }): Promise<{ seller_id: string }> {
    return this.request("POST", "/api/v1/sellers/onboard", input);
  }

  async getSellerOrders(
    sellerId: string,
    filters?: { status?: string; limit?: number; offset?: number },
  ): Promise<{ orders: Order[]; total: number }> {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([k, v]) => {
        if (v !== undefined) params.set(k, String(v));
      });
    }
    const qs = params.toString() ? `?${params.toString()}` : "";
    return this.request("GET", `/api/v1/sellers/${sellerId}/orders${qs}`);
  }

  async getSellerMetrics(sellerId: string): Promise<SellerMetrics> {
    return this.request("GET", `/api/v1/sellers/${sellerId}/metrics`);
  }

  async getSellerPayouts(sellerId: string): Promise<{ payouts: PayoutRecord[] }> {
    return this.request("GET", `/api/v1/sellers/${sellerId}/payouts`);
  }

  // ─── Disputes ─────────────────────────────────────────────────────────────

  async createDispute(input: {
    order_id: string;
    buyer_wallet: string;
    description: string;
    evidence_ipfs_cid?: string;
  }): Promise<{ dispute_id: string }> {
    return this.request("POST", "/api/v1/disputes/create", input);
  }

  async respondToDispute(
    disputeId: string,
    input: { seller_wallet: string; description: string; evidence_ipfs_cid?: string },
  ): Promise<{ status: string }> {
    return this.request("POST", `/api/v1/disputes/${disputeId}/respond`, input);
  }

  async resolveDispute(
    disputeId: string,
    input: {
      outcome: "refund_buyer" | "release_seller" | "partial";
      refund_bps?: number;
      notes?: string;
    },
  ): Promise<{ status: string; tx_hash: string }> {
    return this.request("POST", `/api/v1/disputes/${disputeId}/resolve`, input);
  }

  // ─── Platform ─────────────────────────────────────────────────────────────

  async getPlatformAnalytics(projectId: string): Promise<PlatformAnalytics> {
    return this.request("GET", `/api/v1/platform/${projectId}/analytics`);
  }

  async getPlatformSellers(projectId: string): Promise<{ sellers: Seller[] }> {
    return this.request("GET", `/api/v1/platform/${projectId}/sellers`);
  }

  async getGasCosts(projectId: string): Promise<{
    avg_gas_price_gwei: number;
    total_gas_spent_xrp: number;
    transactions: number;
  }> {
    return this.request("GET", `/api/v1/platform/${projectId}/gas-costs`);
  }

  // ─── Webhooks ─────────────────────────────────────────────────────────────

  async registerWebhook(input: {
    url: string;
    events: string[];
    secret?: string;
  }): Promise<{ webhook_id: string; secret: string }> {
    return this.request("POST", "/api/v1/webhooks/register", input);
  }

  async getWebhookLogs(filters?: {
    limit?: number;
    offset?: number;
  }): Promise<{ logs: WebhookEvent[]; total: number }> {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([k, v]) => {
        if (v !== undefined) params.set(k, String(v));
      });
    }
    const qs = params.toString() ? `?${params.toString()}` : "";
    return this.request("GET", `/api/v1/webhooks/logs${qs}`);
  }

  // ─── Agents ───────────────────────────────────────────────────────────────

  async chatWithAgent(input: {
    role: "buyer" | "seller" | "admin";
    user_id: string;
    message: string;
    session_id?: string;
  }): Promise<AgentResponse> {
    return this.request("POST", "/api/v1/agents/chat", input);
  }

  // ─── Auth ─────────────────────────────────────────────────────────────────

  async createProject(input: {
    name: string;
    webhook_url?: string;
  }): Promise<{ project_id: string; api_key: string }> {
    return this.request("POST", "/api/v1/auth/projects/create", input);
  }

  async rotateApiKey(projectId: string): Promise<{ api_key: string }> {
    return this.request("POST", "/api/v1/auth/api-keys/rotate", { project_id: projectId });
  }
}
