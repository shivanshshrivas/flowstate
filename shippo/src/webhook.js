/**
 * Shippo Tracking Webhook Handler
 *
 * Route: POST /shipping/webhook/shippo
 *
 * Shippo POSTs a JSON payload every time a package tracking status changes.
 * This handler:
 *   1. Validates the request (basic checks; add HMAC if Shippo supports it)
 *   2. Maps the Shippo status to a FlowState escrow event
 *   3. Calls EscrowFSM.advanceState() on-chain when shouldAdvance is true
 *   4. Pins a tracking proof receipt to Pinata IPFS
 *   5. Broadcasts the update over the WebSocket event bus
 *   6. Dispatches a FlowState webhook to the developer's registered URL
 *
 * In the real backend this handler is registered on the Express/Fastify router.
 * For sandbox testing, run `node src/webhook.js` to start a local HTTP server.
 */

const http = require("http");
const { mapToEscrowEvent } = require("./tracking");

const PORT = process.env.WEBHOOK_PORT || 3001;

/**
 * Core handler logic — framework-agnostic.
 * Accepts a parsed Shippo payload and returns the action taken.
 *
 * @param {object} payload - Parsed Shippo webhook body
 * @returns {object} result
 */
async function handleShippoWebhook(payload) {
  const event = payload.event;

  // Shippo sends different event types; we only care about tracking updates.
  if (event !== "track_updated") {
    return { handled: false, reason: `Ignored event type: ${event}` };
  }

  const data = payload.data;
  const trackingNumber = data?.tracking_number;
  const carrier = data?.carrier;
  const status = data?.tracking_status?.status ?? "UNKNOWN";
  const substatus = data?.tracking_status?.substatus ?? null;
  const statusDetails = data?.tracking_status?.status_details ?? "";

  if (!trackingNumber || !carrier) {
    return { handled: false, reason: "Missing tracking_number or carrier" };
  }

  const { escrowEvent, shouldAdvance } = mapToEscrowEvent(status, substatus);

  console.log(`[shippo-webhook] ${carrier} ${trackingNumber}: ${status} → escrowEvent=${escrowEvent}`);

  if (shouldAdvance && escrowEvent) {
    // TODO: look up orderId from DB by trackingNumber
    // TODO: call EscrowFSM.advanceState(orderId, escrowEvent) via ethers.js
    console.log(`[shippo-webhook] Would advance escrow for tracking ${trackingNumber}: ${escrowEvent}`);

    // TODO: pin tracking proof to Pinata IPFS
    // const cid = await pinata.pinJSONToIPFS({ trackingNumber, status, timestamp: new Date() });

    // TODO: broadcast via WebSocket event bus
    // eventBus.emit("order:status", { trackingNumber, escrowEvent });

    // TODO: dispatch developer webhook (HMAC-signed POST to registered URL)
    // await webhookDispatcher.send(projectId, "order.status_updated", { trackingNumber, escrowEvent });
  }

  return {
    handled: true,
    trackingNumber,
    carrier,
    status,
    substatus,
    statusDetails,
    escrowEvent,
    shouldAdvance,
  };
}

// ---------------------------------------------------------------------------
// Standalone HTTP server for local sandbox testing (ngrok → this server)
// ---------------------------------------------------------------------------

if (require.main === module) {
  require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

  const server = http.createServer(async (req, res) => {
    if (req.method !== "POST" || req.url !== "/shipping/webhook/shippo") {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      try {
        const payload = JSON.parse(body);
        const result = await handleShippoWebhook(payload);
        console.log("[shippo-webhook] Result:", JSON.stringify(result, null, 2));
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } catch (err) {
        console.error("[shippo-webhook] Error:", err.message);
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    });
  });

  server.listen(PORT, () => {
    console.log(`Shippo webhook server listening on http://localhost:${PORT}`);
    console.log(`Register this URL in Shippo dashboard:`);
    console.log(`  https://<your-ngrok-subdomain>.ngrok.io/shipping/webhook/shippo`);
    console.log(`Event type: track_updated`);
  });
}

module.exports = { handleShippoWebhook };
