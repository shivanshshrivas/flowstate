/**
 * Tool Isolation Tests
 * -------------------
 * Directly invokes tool functions (no LLM) to verify that data scoping,
 * ownership enforcement, and session isolation work correctly.
 *
 * Run: npx tsx test/tool-isolation.test.ts
 */

import { createBuyerTools } from "../src/tools/buyer-tools.js";
import { createSellerTools } from "../src/tools/seller-tools.js";
import { createAdminTools } from "../src/tools/admin-tools.js";
import { SessionManager } from "../src/session/session-manager.js";
import { config } from "../src/config.js";

// ─── Fixtures ──────────────────────────────────────────────────────────────

const BUYER_A = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"; // owns order-001,002,003,005
const BUYER_B = "0x70997970C51812dc3A010C7d01b50e0d17dc79C9"; // owns order-004

const SELLER_A = "seller-001"; // owns order-001,003,004 + dispute-001
const SELLER_B = "seller-002"; // owns order-002,005 + dispute-002

// Tool helpers — create fresh tool sets per test
const buyerATools = () =>
  createBuyerTools({ userId: BUYER_A, agentType: "buyer" });
const buyerBTools = () =>
  createBuyerTools({ userId: BUYER_B, agentType: "buyer" });
const sellerATools = () =>
  createSellerTools({ userId: SELLER_A, agentType: "seller" });
const sellerBTools = () =>
  createSellerTools({ userId: SELLER_B, agentType: "seller" });

function getToolByName(tools: ReturnType<typeof buyerATools>, name: string) {
  const t = tools.find((x) => x.name === name);
  if (!t) throw new Error(`Tool "${name}" not found`);
  return t;
}

// ─── Minimal runner ────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

async function suite(name: string, fn: () => Promise<void>) {
  console.log(`\n${name}`);
  await fn();
}

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    → ${err instanceof Error ? err.message : String(err)}`);
    failed++;
  }
}

function assert(cond: boolean, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}
function assertContains(text: string, needle: string, label = "") {
  if (!text.includes(needle))
    throw new Error(`${label}Expected to find "${needle}" in:\n  ${text.slice(0, 300)}`);
}
function assertNotContains(text: string, needle: string, label = "") {
  if (text.toLowerCase().includes(needle.toLowerCase()))
    throw new Error(
      `${label}Should NOT contain "${needle}" in:\n  ${text.slice(0, 300)}`,
    );
}

// ─── Suite 1: Buyer Tool — order_status ────────────────────────────────────

await suite("Buyer › order_status", async () => {
  await test("returns full order details for own order", async () => {
    const tool = getToolByName(buyerATools(), "order_status");
    const result = await tool.invoke({ order_id: "order-001" });
    assertContains(result, "order-001", "order id: ");
    assertContains(result, "SHIPPED", "state: ");
    assertContains(result, "9400111899221234567890", "tracking number: ");
  });

  await test("rejects order belonging to another buyer", async () => {
    const tool = getToolByName(buyerATools(), "order_status");
    const result = await tool.invoke({ order_id: "order-004" }); // belongs to BUYER_B
    assertContains(result, "not found", "blocked: ");
    assertNotContains(result, BUYER_B, "no leakage of other wallet: ");
  });

  await test("rejects completely made-up order ID", async () => {
    const tool = getToolByName(buyerATools(), "order_status");
    const result = await tool.invoke({ order_id: "order-999" });
    assertContains(result, "not found");
  });

  await test("buyer B can see their own order (order-004)", async () => {
    const tool = getToolByName(buyerBTools(), "order_status");
    const result = await tool.invoke({ order_id: "order-004" });
    assertContains(result, "order-004");
    assertNotContains(result, "not found");
  });

  await test("buyer B cannot see buyer A's orders", async () => {
    const tool = getToolByName(buyerBTools(), "order_status");
    const result = await tool.invoke({ order_id: "order-001" });
    assertContains(result, "not found");
  });
});

// ─── Suite 2: Buyer Tool — track_shipment ─────────────────────────────────

await suite("Buyer › track_shipment", async () => {
  await test("returns tracking info for own shipped order", async () => {
    const tool = getToolByName(buyerATools(), "track_shipment");
    const result = await tool.invoke({ order_id: "order-001" });
    assertContains(result, "9400111899221234567890", "tracking number present: ");
    assertContains(result, "USPS");
  });

  await test("rejects tracking request for another buyer's order", async () => {
    const tool = getToolByName(buyerATools(), "track_shipment");
    const result = await tool.invoke({ order_id: "order-004" }); // BUYER_B's order
    assertContains(result, "not found");
  });

  await test("returns 'no shipment info' for unshipped order (ESCROWED)", async () => {
    // order-004 belongs to buyer B and is ESCROWED — test with buyer B's session
    const tool = getToolByName(buyerBTools(), "track_shipment");
    const result = await tool.invoke({ order_id: "order-004" });
    assertContains(result, "No shipment information available yet");
  });
});

// ─── Suite 3: Buyer Tool — file_dispute ────────────────────────────────────

await suite("Buyer › file_dispute", async () => {
  await test("rejects dispute on another buyer's order", async () => {
    const tool = getToolByName(buyerATools(), "file_dispute");
    const result = await tool.invoke({
      order_id: "order-004",
      reason: "item_damaged",
      description: "Trying to file on someone else's order",
    });
    assertContains(result, "not found");
  });

  await test("rejects duplicate dispute (order-003 already DISPUTED)", async () => {
    const tool = getToolByName(buyerATools(), "file_dispute");
    const result = await tool.invoke({
      order_id: "order-003",
      reason: "item_damaged",
      description: "Item arrived cracked and unusable",
    });
    assertContains(result, "already exists");
  });

  await test("rejects dispute on finalized order", async () => {
    const tool = getToolByName(buyerATools(), "file_dispute");
    const result = await tool.invoke({
      order_id: "order-005",
      reason: "not_as_described",
      description: "I want to dispute after the fact",
    });
    assertContains(result, "finalized");
  });

  await test("rejects dispute on ESCROWED order (not shipped yet)", async () => {
    const tool = getToolByName(buyerBTools(), "file_dispute");
    const result = await tool.invoke({
      order_id: "order-004",
      reason: "item_not_received",
      description: "I never got my package, it has been weeks",
    });
    assertContains(result, "not shipped yet");
  });

  await test("successfully simulates dispute on own shipped order", async () => {
    const tool = getToolByName(buyerATools(), "file_dispute");
    const result = await tool.invoke({
      order_id: "order-001",
      reason: "item_damaged",
      description: "The keyboard arrived with broken keycaps",
    });
    assertContains(result, "success");
    assertContains(result, "dispute_id");
    assertNotContains(result, BUYER_B, "no other wallet leaked: ");
  });
});

// ─── Suite 4: Buyer Tool — get_receipt ─────────────────────────────────────

await suite("Buyer › get_receipt", async () => {
  await test("returns receipt for own order", async () => {
    const tool = getToolByName(buyerATools(), "get_receipt");
    const result = await tool.invoke({ order_id: "order-002" });
    assertContains(result, "order-002");
    assertContains(result, "Leather Laptop Bag");
    assertContains(result, BUYER_A);
  });

  await test("rejects receipt for another buyer's order", async () => {
    const tool = getToolByName(buyerATools(), "get_receipt");
    const result = await tool.invoke({ order_id: "order-004" });
    assertContains(result, "not found");
    assertNotContains(result, BUYER_B, "wallet not leaked: ");
  });

  await test("receipt does not include other sellers' invoice URLs", async () => {
    const tool = getToolByName(buyerATools(), "get_receipt");
    const result = await tool.invoke({ order_id: "order-001" });
    // Should show order-001's IPFS URL, not order-002's
    assertNotContains(result, "invoice-order-002.pdf");
  });
});

// ─── Suite 5: Buyer Tool — list_my_orders ─────────────────────────────────

await suite("Buyer › list_my_orders", async () => {
  await test("returns only buyer A's orders", async () => {
    const tool = getToolByName(buyerATools(), "list_my_orders");
    const result = await tool.invoke({});
    assertContains(result, "order-001");
    assertContains(result, "order-002");
    assertContains(result, "order-003");
    assertContains(result, "order-005");
    assertNotContains(result, "order-004", "no cross-buyer order: ");
    assertNotContains(result, BUYER_B, "no other buyer wallet: ");
  });

  await test("returns only buyer B's orders", async () => {
    const tool = getToolByName(buyerBTools(), "list_my_orders");
    const result = await tool.invoke({});
    assertContains(result, "order-004");
    assertNotContains(result, "order-001", "no buyer A order: ");
    assertNotContains(result, "order-002", "no buyer A order: ");
    assertNotContains(result, BUYER_A, "no buyer A wallet: ");
  });

  await test("status filter restricts results but still scoped to buyer", async () => {
    const tool = getToolByName(buyerATools(), "list_my_orders");
    const result = await tool.invoke({ status: "SHIPPED" });
    assertContains(result, "order-001"); // SHIPPED, belongs to buyer A
    assertNotContains(result, "order-004"); // ESCROWED, belongs to buyer B
  });
});

// ─── Suite 6: Seller Tool — list_orders ───────────────────────────────────

await suite("Seller › list_orders", async () => {
  await test("seller A only sees their own orders", async () => {
    const tool = getToolByName(sellerATools(), "list_orders");
    const result = await tool.invoke({});
    // seller-001 owns order-001, order-003, order-004
    assertContains(result, "order-001");
    assertContains(result, "order-003");
    assertContains(result, "order-004");
    // seller-002 owns order-002, order-005
    assertNotContains(result, "order-002", "cross-seller leak: ");
    assertNotContains(result, "order-005", "cross-seller leak: ");
  });

  await test("seller B only sees their own orders", async () => {
    const tool = getToolByName(sellerBTools(), "list_orders");
    const result = await tool.invoke({});
    assertContains(result, "order-002");
    assertContains(result, "order-005");
    assertNotContains(result, "order-001", "cross-seller leak: ");
    assertNotContains(result, "order-003", "cross-seller leak: ");
    assertNotContains(result, "order-004", "cross-seller leak: ");
  });

  await test("flags orders needing action for seller A", async () => {
    const tool = getToolByName(sellerATools(), "list_orders");
    const result = await tool.invoke({});
    assertContains(result, "action_required");
    assertContains(result, "order-004"); // ESCROWED — needs label
    assertContains(result, "order-003"); // DISPUTED — needs response
  });

  await test("status filter scoped to seller", async () => {
    const tool = getToolByName(sellerATools(), "list_orders");
    const resultEscrowed = await tool.invoke({ status: "ESCROWED" });
    assertContains(resultEscrowed, "order-004");
    assertNotContains(resultEscrowed, "order-001"); // seller A's, but SHIPPED not ESCROWED
    assertNotContains(resultEscrowed, "order-002"); // seller B's order
  });
});

// ─── Suite 7: Seller Tool — get_metrics ───────────────────────────────────

await suite("Seller › get_metrics", async () => {
  await test("returns seller A's metrics, not seller B's", async () => {
    const tool = getToolByName(sellerATools(), "get_metrics");
    const result = await tool.invoke({});
    assertContains(result, "seller-001");
    assertContains(result, "2.0%"); // seller-001's dispute_rate is 0.02 = 2.0%
    assertNotContains(result, "seller-002");
    assertNotContains(result, "6.5%"); // seller-002's dispute_rate
  });

  await test("returns seller B's metrics, not seller A's", async () => {
    const tool = getToolByName(sellerBTools(), "get_metrics");
    const result = await tool.invoke({});
    assertContains(result, "seller-002");
    assertContains(result, "6.5%"); // seller-002's dispute_rate is 0.065
    assertNotContains(result, "seller-001");
    assertNotContains(result, "12840"); // seller-001's revenue
  });
});

// ─── Suite 8: Seller Tool — confirm_label ─────────────────────────────────

await suite("Seller › confirm_label", async () => {
  await test("seller A can confirm label for their own ESCROWED order", async () => {
    const tool = getToolByName(sellerATools(), "confirm_label");
    const result = await tool.invoke({ order_id: "order-004" });
    assertContains(result, "success");
    assertContains(result, "LABEL_CREATED");
  });

  await test("seller A cannot confirm label for seller B's order", async () => {
    const tool = getToolByName(sellerATools(), "confirm_label");
    const result = await tool.invoke({ order_id: "order-002" }); // belongs to seller-002
    assertContains(result, "not found");
  });

  await test("rejects confirm_label on already-shipped order", async () => {
    const tool = getToolByName(sellerATools(), "confirm_label");
    const result = await tool.invoke({ order_id: "order-001" }); // SHIPPED, not ESCROWED
    assertContains(result, "Cannot confirm label");
    assertContains(result, "SHIPPED");
  });
});

// ─── Suite 9: Seller Tool — respond_dispute ───────────────────────────────

await suite("Seller › respond_dispute", async () => {
  await test("seller A can accept their own dispute", async () => {
    const tool = getToolByName(sellerATools(), "respond_dispute");
    const result = await tool.invoke({
      dispute_id: "dispute-001",
      action: "accept",
    });
    assertContains(result, "success");
    assertContains(result, "RESOLVED");
  });

  await test("seller A cannot respond to seller B's dispute", async () => {
    const tool = getToolByName(sellerATools(), "respond_dispute");
    const result = await tool.invoke({
      dispute_id: "dispute-002", // belongs to seller-002
      action: "contest",
      evidence: "Trying to access another seller's dispute",
    });
    assertContains(result, "not found");
  });

  await test("seller A can contest with evidence", async () => {
    const tool = getToolByName(sellerATools(), "respond_dispute");
    const result = await tool.invoke({
      dispute_id: "dispute-001",
      action: "contest",
      evidence: "We have shipping photos showing item was undamaged",
    });
    assertContains(result, "success");
    assertContains(result, "SELLER_RESPONDED");
  });

  await test("rejects response to already-resolved dispute", async () => {
    // dispute-002 is RESOLVED
    const tool = getToolByName(sellerBTools(), "respond_dispute");
    const result = await tool.invoke({
      dispute_id: "dispute-002",
      action: "accept",
    });
    assertContains(result, "already resolved");
  });
});

// ─── Suite 10: Seller Tool — get_payouts ──────────────────────────────────

await suite("Seller › get_payouts", async () => {
  await test("seller A sees only their payouts", async () => {
    const tool = getToolByName(sellerATools(), "get_payouts");
    const result = await tool.invoke({});
    assertContains(result, "seller-001");
    // seller-001's payout IDs: payout-001,002,007,008
    assertContains(result, "payout-001");
    assertContains(result, "payout-007");
    // seller-002's payout IDs should NOT appear
    assertNotContains(result, "payout-003", "cross-seller payout leak: ");
    assertNotContains(result, "payout-009", "cross-seller payout leak: ");
    assertNotContains(result, "seller-002");
  });

  await test("seller B sees only their payouts", async () => {
    const tool = getToolByName(sellerBTools(), "get_payouts");
    const result = await tool.invoke({});
    assertContains(result, "seller-002");
    assertContains(result, "payout-003");
    assertNotContains(result, "payout-001", "cross-seller payout leak: ");
    assertNotContains(result, "seller-001");
  });

  await test("payout totals match only that seller's records", async () => {
    const tool = getToolByName(sellerATools(), "get_payouts");
    const result = await tool.invoke({});
    const parsed = JSON.parse(result);
    // seller-001 payouts: 23.997 + 23.997 + 38.84 + 38.84 = ~125.67
    const total = parsed.total_paid_usd;
    assert(
      parseFloat(total) > 100 && parseFloat(total) < 150,
      `seller-001 total payout ${total} out of expected range 100–150`,
    );
  });
});

// ─── Suite 11: Admin Tools — data integrity ────────────────────────────────

await suite("Admin › data integrity", async () => {
  const adminTools = createAdminTools();
  const getTool = (name: string) => getToolByName(adminTools, name);

  await test("get_analytics returns platform-wide data", async () => {
    const result = await getTool("get_analytics").invoke({});
    assertContains(result, "234"); // total_orders
    assertContains(result, "48920"); // total_volume_usd
    assertContains(result, "dispute_rate");
  });

  await test("list_sellers returns all 3 sellers", async () => {
    const result = await getTool("list_sellers").invoke({});
    assertContains(result, "seller-001");
    assertContains(result, "seller-002");
    assertContains(result, "seller-003");
  });

  await test("flagged_sellers correctly flags seller-002 and seller-003", async () => {
    const result = await getTool("flagged_sellers").invoke({});
    assertContains(result, "seller-002"); // 6.5% > 5% threshold
    assertContains(result, "seller-003"); // 25% > 5% threshold
    assertNotContains(result, "seller-001"); // 2% is below threshold
  });

  await test("flagged_sellers with custom threshold", async () => {
    const result = await getTool("flagged_sellers").invoke({ threshold: 0.1 });
    assertNotContains(result, "seller-002"); // 6.5% is below 10% threshold
    assertContains(result, "seller-003"); // 25% is above 10% threshold
  });

  await test("flagged_sellers assigns correct risk levels", async () => {
    const result = await getTool("flagged_sellers").invoke({});
    const parsed = JSON.parse(result);
    const s3 = parsed.sellers.find((s: { id: string }) => s.id === "seller-003");
    assert(s3.risk_level === "Critical", `Expected Critical, got ${s3.risk_level}`);
    const s2 = parsed.sellers.find((s: { id: string }) => s.id === "seller-002");
    assert(s2.risk_level === "Elevated", `Expected Elevated, got ${s2.risk_level}`);
  });

  await test("webhook_logs status filter works", async () => {
    const failed = await getTool("webhook_logs").invoke({ status: "failed" });
    assertContains(failed, "failed");
    assertNotContains(failed, '"status":"processed"');
  });

  await test("webhook_logs limit is respected", async () => {
    const result = await getTool("webhook_logs").invoke({ limit: 2 });
    const parsed = JSON.parse(result);
    assert(parsed.stats.total_shown <= 2, "limit not respected");
  });

  await test("gas_report returns cost breakdown", async () => {
    const result = await getTool("gas_report").invoke({});
    assertContains(result, "total_gas_spent_usd");
    assertContains(result, "by_transition");
    assertContains(result, "ESCROWED");
  });
});

// ─── Suite 12: Session Manager ─────────────────────────────────────────────

await suite("Session Manager", async () => {
  await test("creates sessions with unique IDs", async () => {
    const sm = new SessionManager();
    const s1 = sm.create("buyer", BUYER_A);
    const s2 = sm.create("buyer", BUYER_A);
    assert(s1.id !== s2.id, "Session IDs must be unique");
    sm.destroy();
  });

  await test("get() returns stored session", async () => {
    const sm = new SessionManager();
    const session = sm.create("seller", SELLER_A);
    const retrieved = sm.get(session.id);
    assert(retrieved !== null, "Should find session");
    assert(retrieved!.userId === SELLER_A, "userId should match");
    assert(retrieved!.agentType === "seller", "agentType should match");
    sm.destroy();
  });

  await test("get() returns null for non-existent session ID", async () => {
    const sm = new SessionManager();
    const result = sm.get("non-existent-session-id");
    assert(result === null, "Should return null for unknown ID");
    sm.destroy();
  });

  await test("get() returns null for expired session (TTL enforcement)", async () => {
    const sm = new SessionManager();
    const session = sm.create("buyer", BUYER_A);
    // Manually expire the session by backdating lastActiveAt
    const stored = sm.get(session.id)!;
    stored.lastActiveAt = Date.now() - (config.SESSION_TTL_MS + 1000);
    const result = sm.get(session.id);
    assert(result === null, "Expired session should return null");
    sm.destroy();
  });

  await test("sessions have isolated chat histories", async () => {
    const sm = new SessionManager();
    const s1 = sm.create("buyer", BUYER_A);
    const s2 = sm.create("buyer", BUYER_B);
    assert(s1.chatHistory !== s2.chatHistory, "History arrays must be different objects");
    assert(s1.chatHistory.length === 0 && s2.chatHistory.length === 0, "Both start empty");
    sm.destroy();
  });

  await test("update() saves chat history and bumps lastActiveAt", async () => {
    const sm = new SessionManager();
    const session = sm.create("buyer", BUYER_A);
    const before = session.lastActiveAt;
    await new Promise((r) => setTimeout(r, 5)); // ensure time advances
    sm.update(session.id, [{ getType: () => "human", content: "hi" } as any]);
    const updated = sm.get(session.id)!;
    assert(updated.chatHistory.length === 1, "History should have 1 message");
    assert(updated.lastActiveAt > before, "lastActiveAt should be updated");
    sm.destroy();
  });

  await test("resolve() creates new session when no session_id provided", async () => {
    const sm = new SessionManager();
    const { session, isNew, wasExpired } = sm.resolve("admin", "admin");
    assert(isNew, "Should be a new session");
    assert(!wasExpired, "Should not be expired");
    assert(session.agentType === "admin");
    sm.destroy();
  });

  await test("resolve() resumes existing session when valid session_id provided", async () => {
    const sm = new SessionManager();
    const original = sm.create("seller", SELLER_A);
    const { session, isNew, wasExpired } = sm.resolve("seller", SELLER_A, original.id);
    assert(!isNew, "Should not be a new session");
    assert(!wasExpired, "Should not be expired");
    assert(session.id === original.id, "Should return same session");
    sm.destroy();
  });

  await test("resolve() creates new session and marks wasExpired when session_id is stale", async () => {
    const sm = new SessionManager();
    const original = sm.create("buyer", BUYER_A);
    const stored = sm.get(original.id)!;
    stored.lastActiveAt = Date.now() - (config.SESSION_TTL_MS + 1000);
    const { session, isNew, wasExpired } = sm.resolve("buyer", BUYER_A, original.id);
    assert(isNew, "Should create new session");
    assert(wasExpired, "Should mark as expired");
    assert(session.id !== original.id, "Should be a different session");
    sm.destroy();
  });

  await test("enforces MAX_SESSIONS cap", async () => {
    const sm = new SessionManager();
    for (let i = 0; i < config.MAX_SESSIONS; i++) {
      sm.create("buyer", `wallet-${i}`);
    }
    assert(sm.activeCount === config.MAX_SESSIONS, "Should be at cap");
    try {
      sm.create("buyer", "wallet-overflow");
      assert(false, "Should have thrown");
    } catch (err) {
      assertContains(
        (err as Error).message,
        "Session cap reached",
        "Error message: ",
      );
    }
    sm.destroy();
  });

  await test("activeCount reflects live sessions", async () => {
    const sm = new SessionManager();
    assert(sm.activeCount === 0);
    sm.create("buyer", BUYER_A);
    sm.create("seller", SELLER_A);
    assert(sm.activeCount === 2);
    sm.destroy();
  });
});

// ─── Results ───────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error(`\n${failed} test(s) failed.`);
  process.exit(1);
} else {
  console.log("All tests passed.");
}
