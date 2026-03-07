/**
 * FlowState × Shippo — End-to-End Sandbox Test Runner
 *
 * Exercises the full shipping flow against the Shippo test API:
 *   1. Get shipping rates (checkout overlay)
 *   2. Purchase a label (order confirmed)
 *   3. Look up tracking status (order tracking page)
 *   4. Simulate a webhook payload (carrier scan event)
 *
 * Run: node index.js
 */

require("dotenv").config();

const { getShippingRates } = require("./src/rates");
const { purchaseLabel } = require("./src/labels");
const { getTrackingStatus } = require("./src/tracking");
const { handleShippoWebhook } = require("./src/webhook");

// ---------------------------------------------------------------------------
// Test fixtures — US domestic sandbox shipment
// ---------------------------------------------------------------------------

const FROM_ADDRESS = {
  name: "FlowState Warehouse",
  street1: "215 Clayton St",
  city: "San Francisco",
  state: "CA",
  zip: "94117",
  country: "US",
  email: "seller@flowstate.xyz",
};

const TO_ADDRESS = {
  name: "Test Buyer",
  street1: "One MetroTech Center",
  city: "Brooklyn",
  state: "NY",
  zip: "11201",
  country: "US",
  email: "buyer@example.com",
};

const PARCEL = {
  length: "10",
  width:  "8",
  height: "4",
  distanceUnit: "in",
  weight: "1.5",
  massUnit: "lb",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function section(title) {
  console.log("\n" + "─".repeat(60));
  console.log(`  ${title}`);
  console.log("─".repeat(60));
}

function ok(label, value) {
  console.log(`  ✓ ${label}:`, typeof value === "object" ? JSON.stringify(value, null, 4).replace(/^/gm, "    ").trim() : value);
}

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

async function step1_getRates() {
  section("Step 1 — Rate Shopping (checkout overlay)");

  const { shipmentId, rates } = await getShippingRates(FROM_ADDRESS, TO_ADDRESS, PARCEL);

  ok("Shipment ID", shipmentId);
  ok(`Rates returned (${rates.length})`, "");

  rates.forEach((r, i) => {
    console.log(`    [${i}] ${r.carrier} · ${r.service} · $${r.amountUSD} · ${r.days ?? "?"} days · id=${r.rateId}`);
  });

  // Return the cheapest rate for the next step
  const cheapest = rates.sort((a, b) => parseFloat(a.amountUSD) - parseFloat(b.amountUSD))[0];
  console.log(`\n  → Selected cheapest: ${cheapest.carrier} ${cheapest.service} ($${cheapest.amountUSD})`);

  return cheapest.rateId;
}

async function step2_purchaseLabel(rateId) {
  section("Step 2 — Label Purchase (POST /orders/:id/select-shipping)");

  const label = await purchaseLabel(rateId);

  ok("Transaction ID", label.transactionId);
  ok("Tracking Number", label.trackingNumber);
  ok("Carrier", label.carrier);
  ok("Label PDF URL", label.labelUrl);
  ok("Tracking URL", label.trackingUrlProvider);

  console.log("\n  Next steps (TODOs wired in labels.js):");
  console.log("    → Download PDF and pin to Pinata IPFS → store CID in PostgreSQL");
  console.log("    → Call EscrowFSM.advanceState(orderId, 'LABEL_CREATED') → 15% payout");

  return label;
}

async function step3_getTracking(carrier, trackingNumber) {
  section("Step 3 — Tracking Lookup (GET /shipping/track/:orderId)");

  // Sandbox tracking numbers may return UNKNOWN until Shippo simulates transit.
  // In production this is called repeatedly as the package moves.
  const result = await getTrackingStatus(carrier, trackingNumber);

  ok("Status", result.status);
  ok("Substatus", result.substatus);
  ok("Status Details", result.statusDetails);
  ok("ETA", result.eta);
  ok("Escrow event", JSON.stringify(result.escrowEvent));

  if (result.history.length > 0) {
    ok("History", result.history);
  } else {
    console.log("  (No tracking history yet — normal for fresh sandbox label)");
  }

  return result;
}

async function step4_simulateWebhook(carrier, trackingNumber) {
  section("Step 4 — Webhook Simulation (POST /shipping/webhook/shippo)");

  // Simulate what Shippo POSTs when a carrier scans the package
  const mockPayload = {
    event: "track_updated",
    data: {
      carrier,
      tracking_number: trackingNumber,
      tracking_status: {
        status: "TRANSIT",
        substatus: null,
        status_details: "Your shipment is on its way.",
        status_date: new Date().toISOString(),
      },
    },
  };

  console.log("  Simulating Shippo webhook payload: TRANSIT");
  const result = await handleShippoWebhook(mockPayload);
  ok("Handled", result.handled);
  ok("Escrow Event", result.escrowEvent);
  ok("Should Advance Escrow", result.shouldAdvance);

  // Simulate DELIVERED
  mockPayload.data.tracking_status.status = "DELIVERED";
  console.log("\n  Simulating Shippo webhook payload: DELIVERED");
  const delivered = await handleShippoWebhook(mockPayload);
  ok("Escrow Event", delivered.escrowEvent);
  ok("Should Advance Escrow", delivered.shouldAdvance);

  console.log("\n  Next steps (TODOs wired in webhook.js):");
  console.log("    → advanceState() on EscrowFSM.sol for SHIPPED (15%) and DELIVERED (70%)");
  console.log("    → Pin tracking proof to Pinata IPFS");
  console.log("    → Broadcast via WebSocket event bus");
  console.log("    → Dispatch HMAC-signed developer webhook");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("FlowState × Shippo Sandbox");
  console.log("Using key:", process.env.SHIPPO_KEY?.slice(0, 20) + "...");

  try {
    const rateId = await step1_getRates();
    const label  = await step2_purchaseLabel(rateId);
    await step3_getTracking(label.carrier.toLowerCase(), label.trackingNumber);
    await step4_simulateWebhook(label.carrier.toLowerCase(), label.trackingNumber);

    section("Done");
    console.log("  All Shippo sandbox flows completed successfully.");
    console.log("  Next: wire the Pinata SDK (labels.js) and ethers.js (webhook.js) TODOs.\n");
  } catch (err) {
    console.error("\n[ERROR]", err.message);
    if (err.rawResponse) console.error("Raw response:", await err.rawResponse.text());
    process.exit(1);
  }
}

main();
