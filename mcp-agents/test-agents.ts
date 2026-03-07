/**
 * Quick smoke test — calls each agent with a prompt that should trigger tool use.
 * Run with: npx tsx test-agents.ts
 */
import { SessionManager } from "./src/session/session-manager.js";
import { runBuyerAgent } from "./src/agents/buyer-agent.js";
import { runSellerAgent } from "./src/agents/seller-agent.js";
import { runAdminAgent } from "./src/agents/admin-agent.js";

const sm = new SessionManager();

async function test(label: string, fn: () => Promise<string>) {
  process.stdout.write(`\n${"─".repeat(60)}\n${label}\n${"─".repeat(60)}\n`);
  try {
    const result = await fn();
    console.log(result);
  } catch (err) {
    console.error("ERROR:", err instanceof Error ? err.message : err);
  }
}

async function main() {
  console.log("Starting agent tests…\n");

  // ── Buyer agent ──────────────────────────────────────────────────────
  await test("BUYER: list orders", async () => {
    const session = sm.create("buyer", "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");
    const { response } = await runBuyerAgent("Show me all my orders", session, sm);
    return response;
  });

  await test("BUYER: order status (should call order_status tool)", async () => {
    const session = sm.create("buyer", "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");
    const { response } = await runBuyerAgent("Where is my order order-001?", session, sm);
    return response;
  });

  // ── Seller agent ─────────────────────────────────────────────────────
  await test("SELLER: orders needing action (should call list_orders tool)", async () => {
    const session = sm.create("seller", "seller-001");
    const { response } = await runSellerAgent("What orders need my attention?", session, sm);
    return response;
  });

  await test("SELLER: metrics (should call get_metrics tool)", async () => {
    const session = sm.create("seller", "seller-001");
    const { response } = await runSellerAgent("What's my dispute rate and revenue?", session, sm);
    return response;
  });

  // ── Admin agent ───────────────────────────────────────────────────────
  await test("ADMIN: platform analytics (should call get_analytics tool)", async () => {
    const session = sm.create("admin", "admin");
    const { response } = await runAdminAgent("How is the platform doing?", session, sm);
    return response;
  });

  await test("ADMIN: flagged sellers (should call flagged_sellers tool)", async () => {
    const session = sm.create("admin", "admin");
    const { response } = await runAdminAgent("Show me problem sellers", session, sm);
    return response;
  });

  sm.destroy();
  console.log("\nDone.");
}

main();
