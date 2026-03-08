/**
 * Server-side singleton for the FlowState API client.
 * Instantiated from env vars: FLOWSTATE_API_URL + FLOWSTATE_API_KEY.
 * When FLOWSTATE_API_URL is not set, returns null (Supabase/mock fallback used).
 */

// Import the built tarball version (avoid circular import with src/lib/flowstate)
// The apiClient is framework-agnostic (pure fetch), safe for server-side use.

export interface FlowStateServerApiClient {
  listOrders(filters?: { buyer_wallet?: string; seller_id?: string; status?: string; limit?: number; offset?: number }): Promise<{ orders: unknown[]; total: number }>;
  getOrder(id: string): Promise<{ order: unknown; items: unknown[] }>;
  createOrder(input: unknown): Promise<{ order_id: string; shipping_options: unknown[]; escrow_address: string; subtotal_usd: number }>;
  selectShipping(orderId: string, input: { rate_id: string }): Promise<unknown>;
  confirmEscrow(orderId: string, input: { tx_hash: string }): Promise<unknown>;
  confirmLabelPrinted(orderId: string, input: { seller_wallet: string }): Promise<unknown>;
  finalizeOrder(orderId: string): Promise<unknown>;
  getSellerOrders(sellerId: string, filters?: unknown): Promise<{ orders: unknown[]; total: number }>;
  getSellerMetrics(sellerId: string): Promise<unknown>;
  getSellerPayouts(sellerId: string): Promise<{ payouts: unknown[] }>;
  getPlatformAnalytics(projectId: string): Promise<unknown>;
  getPlatformSellers(projectId: string): Promise<{ sellers: unknown[] }>;
  getWebhookLogs(filters?: unknown): Promise<{ logs: unknown[]; total: number }>;
  chatWithAgent(input: { role: string; user_id: string; message: string; session_id?: string }): Promise<unknown>;
}

function createApiClient(baseUrl: string, apiKey: string): FlowStateServerApiClient {
  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const json = await res.json() as { success: boolean; data: T; error?: { message: string } };
    if (!res.ok || !json.success) {
      throw new Error(json.error?.message ?? `API error ${res.status} on ${method} ${path}`);
    }
    return json.data;
  }

  return {
    listOrders: (filters?) => {
      const params = new URLSearchParams();
      if (filters) Object.entries(filters).forEach(([k, v]) => v !== undefined && params.set(k, String(v)));
      const qs = params.toString() ? `?${params}` : "";
      return request("GET", `/api/v1/orders${qs}`);
    },
    getOrder: (id) => request("GET", `/api/v1/orders/${id}`),
    createOrder: (input) => request("POST", "/api/v1/orders/create", input),
    selectShipping: (orderId, input) => request("POST", `/api/v1/orders/${orderId}/select-shipping`, input),
    confirmEscrow: (orderId, input) => request("POST", `/api/v1/orders/${orderId}/confirm-escrow`, input),
    confirmLabelPrinted: (orderId, input) => request("POST", `/api/v1/orders/${orderId}/confirm-label-printed`, input),
    finalizeOrder: (orderId) => request("POST", `/api/v1/orders/${orderId}/finalize`),
    getSellerOrders: (sellerId, filters?) => {
      const params = new URLSearchParams();
      if (filters && typeof filters === "object") Object.entries(filters as Record<string, unknown>).forEach(([k, v]) => v !== undefined && params.set(k, String(v)));
      const qs = params.toString() ? `?${params}` : "";
      return request("GET", `/api/v1/sellers/${sellerId}/orders${qs}`);
    },
    getSellerMetrics: (sellerId) => request("GET", `/api/v1/sellers/${sellerId}/metrics`),
    getSellerPayouts: (sellerId) => request("GET", `/api/v1/sellers/${sellerId}/payouts`),
    getPlatformAnalytics: (projectId) => request("GET", `/api/v1/platform/${projectId}/analytics`),
    getPlatformSellers: (projectId) => request("GET", `/api/v1/platform/${projectId}/sellers`),
    getWebhookLogs: (filters?) => {
      const params = new URLSearchParams();
      if (filters && typeof filters === "object") Object.entries(filters as Record<string, unknown>).forEach(([k, v]) => v !== undefined && params.set(k, String(v)));
      const qs = params.toString() ? `?${params}` : "";
      return request("GET", `/api/v1/webhooks/logs${qs}`);
    },
    chatWithAgent: (input) => request("POST", "/api/v1/agents/chat", input),
  };
}

function getFlowStateApiClient(): FlowStateServerApiClient | null {
  const url = process.env.FLOWSTATE_API_URL;
  const key = process.env.FLOWSTATE_API_KEY;
  if (!url || !key) return null;
  return createApiClient(url.replace(/\/$/, ""), key);
}

export const flowstateApi = getFlowStateApiClient();

export function isFlowStateEnabled(): boolean {
  return flowstateApi !== null;
}
