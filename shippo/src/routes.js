/**
 * Shippo Bridge — Fastify Plugin
 *
 * This module IS the Shippo integration bridge (Sub-Component 5) as described
 * in the architecture. It is NOT a separate service — it registers directly
 * into the main backend Fastify instance (api.flowstate.xyz):
 *
 *   // In the backend API's server.js:
 *   app.register(require('./bridges/shippo/routes'), { prefix: '/api/v1' });
 *
 * Registers two route groups matching the architecture's endpoint table:
 *
 *   Shipping group  prefix /shipping:
 *     POST /api/v1/shipping/rates
 *     GET  /api/v1/shipping/track/:orderId
 *     POST /api/v1/shipping/webhook/shippo
 *
 *   Orders group  prefix /orders  (shipping step only):
 *     POST /api/v1/orders/:id/select-shipping
 */

const { getShippingRates }    = require("./rates");
const { purchaseLabel }       = require("./labels");
const { getTrackingStatus }   = require("./tracking");
const { handleShippoWebhook } = require("./webhook");

// ---------------------------------------------------------------------------
// Shipping routes  →  registered at /shipping  (prefix: /api/v1/shipping)
// ---------------------------------------------------------------------------

async function shippingRoutes(fastify) {
  /**
   * POST /api/v1/shipping/rates
   *
   * Called by the PayButton checkout overlay on open.
   * Architecture sequence (lines 789–802):
   *   PayButton → POST /orders/create → backend calls Shippo
   *   → rates[] cached in Redis → returned to overlay.
   *
   * Body:    { from_address, to_address, parcel }
   * Returns: { shipment_id, rates[] }
   *
   * TODO: cache result in Redis with short TTL (architecture data flow table)
   */
  fastify.post("/rates", async (req, reply) => {
    const { from_address, to_address, parcel } = req.body;

    if (!from_address || !to_address || !parcel) {
      return reply.status(400).send({ error: "from_address, to_address, and parcel are required" });
    }

    const { shipmentId, rates } = await getShippingRates(from_address, to_address, parcel);
    return { shipment_id: shipmentId, rates };
  });

  /**
   * GET /api/v1/shipping/track/:orderId
   *
   * Called by the OrderTracker component for real-time status.
   * Architecture: GET /api/v1/shipping/track/:orderId
   *
   * Query params: carrier, tracking_number
   * TODO: replace query params with PostgreSQL lookup by orderId once DB is wired.
   *
   * Returns: tracking status + escrow event mapping
   */
  fastify.get("/track/:orderId", async (req, reply) => {
    const { orderId } = req.params;
    const { carrier, tracking_number } = req.query;

    if (!carrier || !tracking_number) {
      return reply.status(400).send({
        error: "carrier and tracking_number query params required (DB lookup not yet wired)",
      });
    }

    // TODO: look up carrier + tracking_number from PostgreSQL by orderId
    const result = await getTrackingStatus(carrier, tracking_number);
    return { order_id: orderId, ...result };
  });

  /**
   * POST /api/v1/shipping/webhook/shippo
   *
   * Shippo POSTs here on every carrier scan / tracking update.
   * Architecture sequence (lines 979–1016):
   *   Carrier → Shippo → this endpoint
   *   → mapToEscrowEvent() to classify the update
   *   → TODO: look up orderId from PostgreSQL by tracking_number
   *   → TODO: pin tracking proof receipt JSON to Pinata IPFS → proof_cid
   *   → TODO: EscrowFSM.advanceState(orderId, escrowEvent, proof_cid) via ethers.js
   *   → TODO: broadcast via WebSocket event bus → OrderTracker updates
   *   → TODO: dispatch HMAC-signed webhook to developer's registered URL
   */
  fastify.post("/webhook/shippo", async (req) => {
    const result = await handleShippoWebhook(req.body);
    return { ok: true, ...result };
  });
}

// ---------------------------------------------------------------------------
// Orders route  →  registered at /orders  (prefix: /api/v1/orders)
// ---------------------------------------------------------------------------

async function ordersShippingRoutes(fastify) {
  /**
   * POST /api/v1/orders/:id/select-shipping
   *
   * Buyer selects a shipping rate → backend purchases the Shippo label.
   * Architecture sequence (lines 826–852):
   *   PayButton → POST /orders/:id/select-shipping { option_id }
   *   → Shippo: POST /transactions (purchase label at selected rate)
   *   → TODO: fetch label PDF → pin to Pinata IPFS → label_cid
   *   → TODO: store label_cid in PostgreSQL orders table
   *   → TODO: EscrowFSM.advanceState(orderId, 'LABEL_CREATED', label_cid) → 15% payout
   *
   * Body:    { rate_id }
   * Returns: { order_id, status, tracking_number, carrier, label_url, label_cid }
   */
  fastify.post("/:id/select-shipping", async (req, reply) => {
    const order_id = req.params.id;
    const { rate_id } = req.body;

    if (!rate_id) {
      return reply.status(400).send({ error: "rate_id is required" });
    }

    const label = await purchaseLabel(rate_id);

    // TODO: const { cid, url } = await pinShippingLabel(label.labelUrl, order_id, label.trackingNumber);
    // TODO: await db.orders.update(order_id, { label_cid: cid, tracking_number: label.trackingNumber });
    // TODO: await escrow.advanceState(order_id, "LABEL_CREATED", cid);  // 15% payout

    return {
      order_id,
      status:          "LABEL_CREATED",
      tracking_number: label.trackingNumber,
      tracking_url:    label.trackingUrlProvider,
      carrier:         label.carrier,
      label_url:       label.labelUrl,  // temporary Shippo URL; replaced by IPFS URL once Pinata is wired
      label_cid:       null,            // filled in when Pinata bridge is integrated
    };
  });
}

module.exports = { shippingRoutes, ordersShippingRoutes };
