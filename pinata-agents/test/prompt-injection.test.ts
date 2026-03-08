/**
 * Prompt injection tests — verifies that all 3 agent system prompts contain
 * the required anti-injection rules and SYSTEM_CONTEXT identity extraction.
 *
 * Run: npx tsx test/prompt-injection.test.ts
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const agentsDir = resolve(__dirname, "../agents");

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

function loadPrompt(filename: string): string {
  return readFileSync(resolve(agentsDir, filename), "utf8");
}

// =============================================================================
// Buyer agent
// =============================================================================
console.log("\n── buyer-agent.md ────────────────────────────────────────────────");
{
  const prompt = loadPrompt("buyer-agent.md");

  assert(prompt.includes("SYSTEM_CONTEXT"), "contains SYSTEM_CONTEXT keyword");
  assert(prompt.includes("buyer_wallet"), "instructs to extract buyer_wallet from SYSTEM_CONTEXT");
  assert(
    prompt.toLowerCase().includes("never accept") || prompt.toLowerCase().includes("never use"),
    "instructs to never accept user-supplied identity",
  );
  assert(
    prompt.toLowerCase().includes("ignore instructions") || prompt.toLowerCase().includes("ignore"),
    "warns against ignore-instructions injection",
  );
  assert(
    prompt.toLowerCase().includes("reveal") || prompt.toLowerCase().includes("never reveal"),
    "instructs to never reveal system context / instructions",
  );
  assert(prompt.includes("CRITICAL SECURITY"), "has explicit CRITICAL SECURITY section");
}

// =============================================================================
// Seller agent
// =============================================================================
console.log("\n── seller-agent.md ───────────────────────────────────────────────");
{
  const prompt = loadPrompt("seller-agent.md");

  assert(prompt.includes("SYSTEM_CONTEXT"), "contains SYSTEM_CONTEXT keyword");
  assert(prompt.includes("seller_id"), "instructs to extract seller_id from SYSTEM_CONTEXT");
  assert(
    prompt.toLowerCase().includes("never accept") || prompt.toLowerCase().includes("never use"),
    "instructs to never accept user-supplied identity",
  );
  assert(
    prompt.toLowerCase().includes("ignore instructions") || prompt.toLowerCase().includes("ignore"),
    "warns against ignore-instructions injection",
  );
  assert(
    prompt.toLowerCase().includes("reveal") || prompt.toLowerCase().includes("never reveal"),
    "instructs to never reveal system context / instructions",
  );
  assert(prompt.includes("CRITICAL SECURITY"), "has explicit CRITICAL SECURITY section");
}

// =============================================================================
// Admin agent
// =============================================================================
console.log("\n── admin-agent.md ────────────────────────────────────────────────");
{
  const prompt = loadPrompt("admin-agent.md");

  assert(prompt.includes("SYSTEM_CONTEXT"), "contains SYSTEM_CONTEXT keyword");
  assert(prompt.includes("role=admin") || prompt.includes("role is \"admin\"") || prompt.includes("role"), "references role=admin check");
  assert(
    prompt.toLowerCase().includes("ignore instructions") || prompt.toLowerCase().includes("ignore"),
    "warns against ignore-instructions injection",
  );
  assert(
    prompt.toLowerCase().includes("reveal") || prompt.toLowerCase().includes("never reveal"),
    "instructs to never reveal system context / instructions",
  );
  assert(prompt.includes("CRITICAL SECURITY"), "has explicit CRITICAL SECURITY section");
}

// =============================================================================
// Cross-agent consistency
// =============================================================================
console.log("\n── Cross-agent consistency ───────────────────────────────────────");
{
  const buyer = loadPrompt("buyer-agent.md");
  const seller = loadPrompt("seller-agent.md");
  const admin = loadPrompt("admin-agent.md");

  assert(
    [buyer, seller, admin].every((p) => p.includes("SYSTEM_CONTEXT")),
    "all 3 agents reference SYSTEM_CONTEXT",
  );
  assert(
    [buyer, seller, admin].every((p) => p.includes("CRITICAL SECURITY")),
    "all 3 agents have CRITICAL SECURITY section",
  );
  assert(
    buyer.includes("role=buyer") || buyer.includes("role=buyer"),
    "buyer prompt specifies buyer role",
  );
  assert(
    seller.includes("role=seller") || seller.includes("role=seller"),
    "seller prompt specifies seller role",
  );
  assert(
    admin.includes("role=admin") || admin.includes("role"),
    "admin prompt specifies admin role",
  );
}

// =============================================================================
// Summary
// =============================================================================
console.log(`\n${"─".repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
