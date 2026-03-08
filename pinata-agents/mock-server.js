/**
 * Lightweight mock server for testing Pinata agent skill calls.
 * Returns realistic fake data for all endpoints used by buyer/seller/admin skills.
 *
 * Usage: node pinata-agents/mock-server.js
 * Then expose with: ngrok http 4000
 * Set FLOWSTATE_API_URL=https://<ngrok>.ngrok-free.app in Pinata skill env vars.
 */

import http from "http";
import { URL } from "url";

const PORT = 4000;
const API_KEY = "fs_live_key_Mgm60nfiviw2jOGBMnP63";

// ── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_ORDERS = [
  {
    id: "order-001",
    state: "SHIPPED",
    buyer_wallet: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    seller_id: "seller-wallet-001",
    seller_name: "Acme Co",
    total_usd: 49.99,
    created_at: "2026-02-20T10:00:00Z",
    updated_at: "2026-02-22T14:30:00Z",
    tracking_number: "1Z999AA10123456784",
    carrier: "UPS",
    estimated_delivery: "2026-02-25T00:00:00Z",
    items: [
      { product_name: "Wireless Mouse", quantity: 1, price_usd: 39.99 },
      { product_name: "USB Hub", quantity: 1, price_usd: 10.00 },
    ],
  },
  {
    id: "order-002",
    state: "ESCROWED",
    buyer_wallet: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    seller_id: "seller-wallet-001",
    seller_name: "Acme Co",
    total_usd: 129.00,
    created_at: "2026-03-01T09:00:00Z",
    updated_at: "2026-03-01T09:05:00Z",
    items: [
      { product_name: "Mechanical Keyboard", quantity: 1, price_usd: 129.00 },
    ],
  },
  {
    id: "order-003",
    state: "DELIVERED",
    buyer_wallet: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    seller_id: "seller-wallet-001",
    seller_name: "Acme Co",
    total_usd: 19.99,
    created_at: "2026-01-15T08:00:00Z",
    updated_at: "2026-01-20T16:00:00Z",
    items: [
      { product_name: "Mouse Pad XL", quantity: 1, price_usd: 19.99 },
    ],
  },
];

const MOCK_SELLER_ORDERS = [
  { id: "order-001", state: "SHIPPED",  buyer_wallet: "0xf39Fd6...", total_usd: 49.99,  created_at: "2026-02-20T10:00:00Z" },
  { id: "order-002", state: "ESCROWED", buyer_wallet: "0xabc123...", total_usd: 129.00, created_at: "2026-03-01T09:00:00Z" },
  { id: "order-004", state: "ESCROWED", buyer_wallet: "0xdef456...", total_usd: 79.50,  created_at: "2026-03-05T11:00:00Z" },
  { id: "order-005", state: "LABEL_CREATED", buyer_wallet: "0xghi789...", total_usd: 55.00, created_at: "2026-03-06T08:30:00Z" },
];

const MOCK_METRICS = {
  seller_id: "seller-wallet-001",
  period_days: 30,
  total_revenue_usd: 8420.50,
  total_orders: 47,
  completed_orders: 38,
  active_orders: 9,
  dispute_rate: 0.042,
  avg_order_value_usd: 179.16,
  top_products: [
    { name: "Mechanical Keyboard", units_sold: 18, revenue_usd: 2322.00 },
    { name: "Wireless Mouse",      units_sold: 14, revenue_usd:  559.86 },
    { name: "USB Hub",             units_sold: 11, revenue_usd:  110.00 },
  ],
};

const MOCK_PAYOUTS = [
  { id: "pay-001", order_id: "order-003", amount_token: "19.5",  phase: "DELIVERED",  tx_hash: "0xabc...", created_at: "2026-01-21T00:00:00Z" },
  { id: "pay-002", order_id: "order-006", amount_token: "63.2",  phase: "SHIPPED",    tx_hash: "0xdef...", created_at: "2026-02-10T00:00:00Z" },
  { id: "pay-003", order_id: "order-007", amount_token: "125.0", phase: "FINALIZED",  tx_hash: "0xghi...", created_at: "2026-03-01T00:00:00Z" },
];

const MOCK_ANALYTICS = {
  period_days: 30,
  total_orders: 312,
  completed_orders: 267,
  active_orders: 45,
  total_gmv_usd: 54820.00,
  platform_fee_collected_usd: 1370.50,
  total_disputes: 14,
  dispute_rate: 0.045,
  active_sellers: 23,
  new_sellers_this_period: 4,
  avg_order_value_usd: 175.70,
};

const MOCK_SELLERS = [
  { id: "seller-001", business_name: "Acme Co",       wallet: "0xS1...", dispute_rate: 0.03, total_orders: 87,  active: true },
  { id: "seller-002", business_name: "TechGadgets",   wallet: "0xS2...", dispute_rate: 0.18, total_orders: 52,  active: true },
  { id: "seller-003", business_name: "QuickShip LLC", wallet: "0xS3...", dispute_rate: 0.02, total_orders: 134, active: true },
  { id: "seller-004", business_name: "BadActor Inc",  wallet: "0xS4...", dispute_rate: 0.45, total_orders: 20,  active: true },
];

const MOCK_GAS_COSTS = {
  period: "last_30_days",
  total_gas_usd: 18.42,
  breakdown: [
    { function: "lockEscrow",    calls: 312, avg_gas_units: 65000, total_usd:  8.10 },
    { function: "releasePayout", calls: 267, avg_gas_units: 55000, total_usd:  5.84 },
    { function: "resolveDispute",calls:  14, avg_gas_units: 82000, total_usd:  4.48 },
  ],
};

const MOCK_WEBHOOK_LOGS = [
  { id: "wh-001", event: "order.shipped",    status: "delivered", attempts: 1, created_at: "2026-03-07T10:00:00Z" },
  { id: "wh-002", event: "order.escrowed",   status: "delivered", attempts: 1, created_at: "2026-03-07T09:00:00Z" },
  { id: "wh-003", event: "dispute.opened",   status: "failed",    attempts: 3, created_at: "2026-03-06T15:00:00Z", error: "Connection refused" },
  { id: "wh-004", event: "payout.released",  status: "delivered", attempts: 1, created_at: "2026-03-06T12:00:00Z" },
  { id: "wh-005", event: "order.finalized",  status: "failed",    attempts: 3, created_at: "2026-03-05T08:00:00Z", error: "Timeout" },
];

const MOCK_TRACKING = {
  order_id: "order-001",
  carrier: "UPS",
  tracking_number: "1Z999AA10123456784",
  status: "IN_TRANSIT",
  estimated_delivery: "2026-03-10T00:00:00Z",
  events: [
    { timestamp: "2026-03-07T08:00:00Z", location: "Chicago, IL",   description: "Package in transit" },
    { timestamp: "2026-03-06T18:00:00Z", location: "Louisville, KY", description: "Departed facility" },
    { timestamp: "2026-03-06T10:00:00Z", location: "Louisville, KY", description: "Arrived at facility" },
    { timestamp: "2026-03-05T14:00:00Z", location: "New York, NY",   description: "Package picked up" },
  ],
};

// ── Router ────────────────────────────────────────────────────────────────────

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

function checkAuth(req, res) {
  const auth = req.headers["authorization"] ?? "";
  if (!auth.startsWith("Bearer ")) {
    json(res, 401, { success: false, error: { code: "MISSING_API_KEY" } });
    return false;
  }
  return true; // accept any bearer token in mock
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;
  const q = url.searchParams;

  console.log(`[mock] ${req.method} ${path}`);

  // Health
  if (path === "/health") {
    return json(res, 200, { status: "ok (mock)", timestamp: new Date().toISOString() });
  }

  if (!checkAuth(req, res)) return;

  // ── GET /api/v1/orders?buyer=<wallet>&status=<state> ─────────────────────
  if (req.method === "GET" && path === "/api/v1/orders") {
    const buyer = q.get("buyer");
    const status = q.get("status");
    let orders = MOCK_ORDERS.filter(o => !buyer || o.buyer_wallet === buyer);
    if (status) orders = orders.filter(o => o.state === status);
    return json(res, 200, { success: true, data: { orders, total: orders.length } });
  }

  // ── GET /api/v1/orders/:id ────────────────────────────────────────────────
  if (req.method === "GET" && path.startsWith("/api/v1/orders/")) {
    const id = decodeURIComponent(path.split("/api/v1/orders/")[1]);
    const order = MOCK_ORDERS.find(o => o.id === id) ?? {
      id, state: "ESCROWED", buyer_wallet: "0xf39Fd6...",
      seller_name: "Acme Co", total_usd: 99.00,
      created_at: new Date().toISOString(), items: [],
    };
    return json(res, 200, { success: true, data: { order, items: order.items ?? [] } });
  }

  // ── GET /api/v1/sellers/:id/orders ───────────────────────────────────────
  if (req.method === "GET" && /^\/api\/v1\/sellers\/[^/]+\/orders$/.test(path)) {
    const status = q.get("status");
    let orders = MOCK_SELLER_ORDERS;
    if (status) orders = orders.filter(o => o.state === status);
    return json(res, 200, { success: true, data: { orders, total: orders.length } });
  }

  // ── GET /api/v1/sellers/:id/metrics ──────────────────────────────────────
  if (req.method === "GET" && /^\/api\/v1\/sellers\/[^/]+\/metrics$/.test(path)) {
    return json(res, 200, { success: true, data: MOCK_METRICS });
  }

  // ── GET /api/v1/sellers/:id/payouts ──────────────────────────────────────
  if (req.method === "GET" && /^\/api\/v1\/sellers\/[^/]+\/payouts$/.test(path)) {
    return json(res, 200, { success: true, data: { payouts: MOCK_PAYOUTS, total: MOCK_PAYOUTS.length } });
  }

  // ── POST /api/v1/orders/:id/confirm-label-printed ────────────────────────
  if (req.method === "POST" && path.includes("/confirm-label-printed")) {
    return json(res, 200, { success: true, data: { status: "LABEL_CREATED", payout_amount_token: "12.5", tx_hash: "0xmock..." } });
  }

  // ── GET /api/v1/shipping/track/:orderId ──────────────────────────────────
  if (req.method === "GET" && path.startsWith("/api/v1/shipping/track/")) {
    return json(res, 200, { success: true, data: MOCK_TRACKING });
  }

  // ── POST /api/v1/disputes/create ─────────────────────────────────────────
  if (req.method === "POST" && path === "/api/v1/disputes/create") {
    return json(res, 201, { success: true, data: { dispute_id: `dispute-${Date.now()}`, status: "OPENED" } });
  }

  // ── POST /api/v1/disputes/:id/respond ────────────────────────────────────
  if (req.method === "POST" && path.includes("/disputes/") && path.endsWith("/respond")) {
    return json(res, 200, { success: true, data: { status: "RESPONDED" } });
  }

  // ── GET /api/v1/platform/:projectId/analytics ────────────────────────────
  if (req.method === "GET" && path.includes("/platform/") && path.endsWith("/analytics")) {
    return json(res, 200, { success: true, data: MOCK_ANALYTICS });
  }

  // ── GET /api/v1/platform/:projectId/sellers ──────────────────────────────
  if (req.method === "GET" && path.includes("/platform/") && path.endsWith("/sellers")) {
    const flagged = q.get("flagged") === "true";
    const threshold = parseFloat(q.get("threshold") ?? "0.1");
    const sellers = flagged
      ? MOCK_SELLERS.filter(s => s.dispute_rate >= threshold)
      : MOCK_SELLERS;
    return json(res, 200, { success: true, data: { sellers, total: sellers.length } });
  }

  // ── GET /api/v1/platform/:projectId/gas-costs ────────────────────────────
  if (req.method === "GET" && path.includes("/platform/") && path.endsWith("/gas-costs")) {
    return json(res, 200, { success: true, data: MOCK_GAS_COSTS });
  }

  // ── GET /api/v1/webhooks/logs ─────────────────────────────────────────────
  if (req.method === "GET" && path === "/api/v1/webhooks/logs") {
    const status = q.get("status");
    const limit = Math.min(50, parseInt(q.get("limit") ?? "20", 10));
    let logs = MOCK_WEBHOOK_LOGS;
    if (status) logs = logs.filter(l => l.status === status);
    return json(res, 200, { success: true, data: { logs: logs.slice(0, limit), total: logs.length } });
  }

  // 404
  console.log(`[mock] 404 — no handler for ${req.method} ${path}`);
  json(res, 404, { success: false, error: { code: "NOT_FOUND", path } });
});

server.listen(PORT, () => {
  console.log(`\nMock server running on http://localhost:${PORT}`);
  console.log(`  API key accepted: any Bearer token (mock bypasses auth)`);
  console.log(`\nNext steps:`);
  console.log(`  1. Run: ngrok http ${PORT}`);
  console.log(`  2. Copy the https URL from ngrok`);
  console.log(`  3. In Pinata dashboard → each agent → Environment Variables, set:`);
  console.log(`       FLOWSTATE_API_URL = <ngrok-url>`);
  console.log(`       FLOWSTATE_API_KEY = ${API_KEY}`);
  console.log(`  4. Run: npm run test:live  (in pinata-agents/)\n`);
});
