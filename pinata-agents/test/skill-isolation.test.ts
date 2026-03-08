/**
 * Skill isolation tests — verifies correct API endpoint construction,
 * X-Caller-User-Id / X-Caller-Role headers, and required param validation.
 *
 * Run: npx tsx test/skill-isolation.test.ts
 */

import { createRequire } from "module";

const require = createRequire(import.meta.url);

// ── tiny test runner ──────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string): void {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    failed++;
  }
}

// ── fetch mock infrastructure ─────────────────────────────────────────────────
interface CapturedRequest {
  url: string;
  init: RequestInit;
}

let captured: CapturedRequest | null = null;

function mockFetch(status = 200, body: unknown = { ok: true }) {
  captured = null;
  (globalThis as any).fetch = async (url: string, init: RequestInit = {}) => {
    captured = { url, init };
    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => JSON.stringify(body),
      json: async () => body,
    };
  };
}

function getHeaders(): Record<string, string> {
  return (captured?.init?.headers ?? {}) as Record<string, string>;
}

// ── helpers ───────────────────────────────────────────────────────────────────
function skill(path: string) {
  return require(`../skills/${path}/index.js`);
}

// =============================================================================
// BUYER SKILLS
// =============================================================================

console.log("\n── buyer/list-my-orders ──────────────────────────────────────────");
{
  const s = skill("buyer/list-my-orders");

  console.log("  required params:");
  mockFetch();
  const r1 = await s.run({});
  assert(typeof r1.error === "string", "missing buyer_wallet returns error");

  console.log("  happy path:");
  mockFetch();
  await s.run({ buyer_wallet: "0xBuyer1" });
  assert(captured !== null, "fetch was called");
  assert(captured!.url.includes("/api/v1/orders"), "calls /orders endpoint");
  assert(captured!.url.includes("buyer=0xBuyer1"), "buyer_wallet in query");
  assert(getHeaders()["X-Caller-User-Id"] === "0xBuyer1", "X-Caller-User-Id header = buyer_wallet");
  assert(getHeaders()["X-Caller-Role"] === "buyer", "X-Caller-Role header = buyer");

  console.log("  status filter:");
  mockFetch();
  await s.run({ buyer_wallet: "0xBuyer1", status: "SHIPPED" });
  assert(captured!.url.includes("status=SHIPPED"), "status filter in query");
}

console.log("\n── buyer/order-status ────────────────────────────────────────────");
{
  const s = skill("buyer/order-status");

  mockFetch();
  const r1 = await s.run({});
  assert(typeof r1.error === "string", "missing buyer_wallet returns error");

  mockFetch();
  const r2 = await s.run({ buyer_wallet: "0xBuyer1" });
  assert(typeof r2.error === "string", "missing order_id returns error");

  mockFetch();
  await s.run({ buyer_wallet: "0xBuyer1", order_id: "ord-123" });
  assert(captured!.url.includes("/api/v1/orders/ord-123"), "calls /orders/:id");
  assert(getHeaders()["X-Caller-User-Id"] === "0xBuyer1", "X-Caller-User-Id set");
  assert(getHeaders()["X-Caller-Role"] === "buyer", "X-Caller-Role = buyer");

  // encodeURIComponent on path param
  mockFetch();
  await s.run({ buyer_wallet: "0xBuyer1", order_id: "ord/with spaces" });
  assert(captured!.url.includes("ord%2Fwith%20spaces"), "order_id is URI-encoded");
}

console.log("\n── buyer/get-receipt ─────────────────────────────────────────────");
{
  const s = skill("buyer/get-receipt");

  mockFetch();
  const r1 = await s.run({});
  assert(typeof r1.error === "string", "missing buyer_wallet returns error");

  const fakeOrder = {
    id: "ord-1",
    created_at: new Date().toISOString(),
    seller_name: "AcmeCo",
    buyer_wallet: "0xBuyer1",
    items: [{ product_name: "Widget", quantity: 2, price_usd: 10 }],
    total_usd: 22,
    state: "DELIVERED",
  };
  mockFetch(200, fakeOrder);
  const r2 = await s.run({ buyer_wallet: "0xBuyer1", order_id: "ord-1" });
  assert(r2.receipt !== undefined, "returns receipt object");
  assert(getHeaders()["X-Caller-User-Id"] === "0xBuyer1", "X-Caller-User-Id set");
  assert(getHeaders()["X-Caller-Role"] === "buyer", "X-Caller-Role = buyer");
}

console.log("\n── buyer/track-shipment ──────────────────────────────────────────");
{
  const s = skill("buyer/track-shipment");

  mockFetch();
  const r1 = await s.run({});
  assert(typeof r1.error === "string", "missing buyer_wallet returns error");

  mockFetch();
  const r2 = await s.run({ buyer_wallet: "0xBuyer1" });
  assert(typeof r2.error === "string", "missing order_id returns error");

  mockFetch();
  await s.run({ buyer_wallet: "0xBuyer1", order_id: "ord-123" });
  assert(captured!.url.includes("/api/v1/shipping/track/ord-123"), "calls /shipping/track/:id");
  assert(getHeaders()["X-Caller-User-Id"] === "0xBuyer1", "X-Caller-User-Id set");
  assert(getHeaders()["X-Caller-Role"] === "buyer", "X-Caller-Role = buyer");
}

console.log("\n── buyer/file-dispute ────────────────────────────────────────────");
{
  const s = skill("buyer/file-dispute");

  mockFetch();
  const r1 = await s.run({});
  assert(typeof r1.error === "string", "missing buyer_wallet returns error");

  mockFetch();
  const r2 = await s.run({ buyer_wallet: "0xB" });
  assert(typeof r2.error === "string", "missing order_id returns error");

  mockFetch();
  const r3 = await s.run({ buyer_wallet: "0xB", order_id: "ord-1" });
  assert(typeof r3.error === "string", "missing reason returns error");

  mockFetch();
  const r4 = await s.run({ buyer_wallet: "0xB", order_id: "ord-1", reason: "bad_reason" });
  assert(typeof r4.error === "string", "invalid reason returns error");

  mockFetch();
  const r5 = await s.run({ buyer_wallet: "0xB", order_id: "ord-1", reason: "item_damaged", description: "short" });
  assert(typeof r5.error === "string", "short description returns error");

  mockFetch(201, { dispute_id: "d-1" });
  await s.run({ buyer_wallet: "0xBuyer1", order_id: "ord-1", reason: "item_damaged", description: "The item arrived completely destroyed." });
  assert(captured!.url.includes("/api/v1/disputes/create"), "calls /disputes/create");
  assert(captured!.init.method === "POST", "uses POST");
  assert(getHeaders()["X-Caller-User-Id"] === "0xBuyer1", "X-Caller-User-Id set");
  assert(getHeaders()["X-Caller-Role"] === "buyer", "X-Caller-Role = buyer");
}

// =============================================================================
// SELLER SKILLS
// =============================================================================

console.log("\n── seller/list-orders ────────────────────────────────────────────");
{
  const s = skill("seller/list-orders");

  mockFetch();
  const r1 = await s.run({});
  assert(typeof r1.error === "string", "missing seller_id returns error");

  mockFetch();
  await s.run({ seller_id: "seller-abc" });
  assert(captured!.url.includes("/api/v1/sellers/seller-abc/orders"), "calls /sellers/:id/orders");
  assert(getHeaders()["X-Caller-User-Id"] === "seller-abc", "X-Caller-User-Id = seller_id");
  assert(getHeaders()["X-Caller-Role"] === "seller", "X-Caller-Role = seller");

  mockFetch();
  await s.run({ seller_id: "seller-abc", status: "ESCROWED" });
  assert(captured!.url.includes("status=ESCROWED"), "status filter applied");
}

console.log("\n── seller/get-metrics ────────────────────────────────────────────");
{
  const s = skill("seller/get-metrics");

  mockFetch();
  const r1 = await s.run({});
  assert(typeof r1.error === "string", "missing seller_id returns error");

  mockFetch();
  await s.run({ seller_id: "seller-abc" });
  assert(captured!.url.includes("/api/v1/sellers/seller-abc/metrics"), "calls /sellers/:id/metrics");
  assert(getHeaders()["X-Caller-User-Id"] === "seller-abc", "X-Caller-User-Id = seller_id");
  assert(getHeaders()["X-Caller-Role"] === "seller", "X-Caller-Role = seller");
}

console.log("\n── seller/get-payouts ────────────────────────────────────────────");
{
  const s = skill("seller/get-payouts");

  mockFetch();
  const r1 = await s.run({});
  assert(typeof r1.error === "string", "missing seller_id returns error");

  mockFetch();
  await s.run({ seller_id: "seller-abc" });
  assert(captured!.url.includes("/api/v1/sellers/seller-abc/payouts"), "calls /sellers/:id/payouts");
  assert(getHeaders()["X-Caller-User-Id"] === "seller-abc", "X-Caller-User-Id = seller_id");
  assert(getHeaders()["X-Caller-Role"] === "seller", "X-Caller-Role = seller");
}

console.log("\n── seller/confirm-label ──────────────────────────────────────────");
{
  const s = skill("seller/confirm-label");

  mockFetch();
  const r1 = await s.run({});
  assert(typeof r1.error === "string", "missing seller_id returns error");

  mockFetch();
  const r2 = await s.run({ seller_id: "seller-abc" });
  assert(typeof r2.error === "string", "missing order_id returns error");

  mockFetch(200, { status: "LABEL_CREATED" });
  await s.run({ seller_id: "seller-abc", order_id: "ord-999" });
  assert(captured!.url.includes("/api/v1/orders/ord-999/confirm-label-printed"), "calls confirm-label-printed");
  assert(captured!.init.method === "POST", "uses POST");
  assert(getHeaders()["X-Caller-User-Id"] === "seller-abc", "X-Caller-User-Id = seller_id");
  assert(getHeaders()["X-Caller-Role"] === "seller", "X-Caller-Role = seller");
  const body = JSON.parse(captured!.init.body as string);
  assert(body.seller_wallet === "seller-abc", "seller_wallet in body");
}

console.log("\n── seller/respond-dispute ────────────────────────────────────────");
{
  const s = skill("seller/respond-dispute");

  mockFetch();
  const r1 = await s.run({});
  assert(typeof r1.error === "string", "missing seller_id returns error");

  mockFetch();
  const r2 = await s.run({ seller_id: "seller-abc" });
  assert(typeof r2.error === "string", "missing dispute_id returns error");

  mockFetch();
  const r3 = await s.run({ seller_id: "seller-abc", dispute_id: "d-1" });
  assert(typeof r3.error === "string", "missing action returns error");

  mockFetch();
  const r4 = await s.run({ seller_id: "seller-abc", dispute_id: "d-1", action: "contest" });
  assert(typeof r4.error === "string", "contest without evidence returns error");

  mockFetch(200, { ok: true });
  await s.run({ seller_id: "seller-abc", dispute_id: "d-1", action: "accept" });
  assert(captured!.url.includes("/api/v1/disputes/d-1/respond"), "calls /disputes/:id/respond");
  assert(captured!.init.method === "POST", "uses POST");
  assert(getHeaders()["X-Caller-User-Id"] === "seller-abc", "X-Caller-User-Id = seller_id");
  assert(getHeaders()["X-Caller-Role"] === "seller", "X-Caller-Role = seller");
}

// =============================================================================
// ADMIN SKILLS
// =============================================================================

console.log("\n── admin/get-analytics ───────────────────────────────────────────");
{
  const s = skill("admin/get-analytics");

  mockFetch();
  const r1 = await s.run({});
  assert(typeof r1.error === "string", "missing project_id returns error");

  mockFetch();
  await s.run({ project_id: "proj-1" });
  assert(captured!.url.includes("/api/v1/platform/proj-1/analytics"), "calls /platform/:id/analytics");
  assert(getHeaders()["X-Caller-User-Id"] === "proj-1", "X-Caller-User-Id = project_id");
  assert(getHeaders()["X-Caller-Role"] === "admin", "X-Caller-Role = admin");
}

console.log("\n── admin/list-sellers ────────────────────────────────────────────");
{
  const s = skill("admin/list-sellers");

  mockFetch();
  const r1 = await s.run({});
  assert(typeof r1.error === "string", "missing project_id returns error");

  mockFetch();
  await s.run({ project_id: "proj-1" });
  assert(captured!.url.includes("/api/v1/platform/proj-1/sellers"), "calls /platform/:id/sellers");
  assert(getHeaders()["X-Caller-Role"] === "admin", "X-Caller-Role = admin");
}

console.log("\n── admin/flagged-sellers ─────────────────────────────────────────");
{
  const s = skill("admin/flagged-sellers");

  mockFetch();
  const r1 = await s.run({});
  assert(typeof r1.error === "string", "missing project_id returns error");

  mockFetch();
  await s.run({ project_id: "proj-1", threshold: 0.1 });
  assert(captured!.url.includes("flagged=true"), "flagged param set");
  assert(captured!.url.includes("threshold=0.1"), "threshold param set");
  assert(getHeaders()["X-Caller-Role"] === "admin", "X-Caller-Role = admin");
}

console.log("\n── admin/gas-report ──────────────────────────────────────────────");
{
  const s = skill("admin/gas-report");

  mockFetch();
  const r1 = await s.run({});
  assert(typeof r1.error === "string", "missing project_id returns error");

  mockFetch();
  await s.run({ project_id: "proj-1" });
  assert(captured!.url.includes("/api/v1/platform/proj-1/gas-costs"), "calls /platform/:id/gas-costs");
  assert(getHeaders()["X-Caller-User-Id"] === "proj-1", "X-Caller-User-Id = project_id");
  assert(getHeaders()["X-Caller-Role"] === "admin", "X-Caller-Role = admin");
}

console.log("\n── admin/webhook-logs ────────────────────────────────────────────");
{
  const s = skill("admin/webhook-logs");

  mockFetch();
  await s.run({});
  assert(captured!.url.includes("/api/v1/webhooks/logs"), "calls /webhooks/logs");
  assert(getHeaders()["X-Caller-Role"] === "admin", "X-Caller-Role = admin");

  mockFetch();
  await s.run({ status: "failed", limit: 100 });
  assert(captured!.url.includes("status=failed"), "status filter applied");
  assert(captured!.url.includes("limit=50"), "limit clamped to 50");
}

// =============================================================================
// Summary
// =============================================================================
console.log(`\n${"─".repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
