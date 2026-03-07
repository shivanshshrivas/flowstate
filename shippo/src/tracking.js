const { shippo } = require("./client");

/**
 * Escrow state machine states (mirrors EscrowStateMachine.sol):
 *
 *   INITIATED → ESCROWED → LABEL_CREATED → SHIPPED → IN_TRANSIT → DELIVERED → FINALIZED
 *                                                          ↓
 *                                                       DISPUTED
 *
 * Payout schedule (basis points of escrowed amount):
 *   LABEL_CREATED  →  15%  (seller prints label)
 *   SHIPPED        →  15%  (first carrier scan)
 *   DELIVERED      →  70%  (confirmed delivery; minus platform fee)
 *   FINALIZED      →  holdback released after grace period
 */

/**
 * Maps a Shippo tracking status + substatus to a FlowState escrow event.
 *
 * Called by: the webhook handler (webhook.js) on every Shippo tracking update.
 * The returned event is then passed to EscrowFSM.advanceState() on-chain.
 *
 * Shippo status values:
 *   UNKNOWN | PRE_TRANSIT | TRANSIT | DELIVERED | RETURNED | FAILURE
 *
 * @param {string} status     - Shippo top-level status
 * @param {string} substatus  - Shippo substatus code (can be null)
 * @returns {{ escrowEvent: string|null, shouldAdvance: boolean }}
 */
function mapToEscrowEvent(status, substatus) {
  switch (status) {
    case "PRE_TRANSIT":
      // Label scanned at origin / accepted by carrier
      return { escrowEvent: "LABEL_SCANNED", shouldAdvance: false };

    case "TRANSIT":
      if (substatus === "out_for_delivery") {
        return { escrowEvent: "OUT_FOR_DELIVERY", shouldAdvance: false };
      }
      // First TRANSIT event → SHIPPED state → 15% payout
      return { escrowEvent: "SHIPPED", shouldAdvance: true };

    case "DELIVERED":
      // → DELIVERED state → 70% payout (grace period timer starts)
      return { escrowEvent: "DELIVERED", shouldAdvance: true };

    case "RETURNED":
      // Package being returned — freeze remaining funds, flag for review
      return { escrowEvent: "RETURN_INITIATED", shouldAdvance: false };

    case "FAILURE":
      // Delivery failed — initiate dispute window
      return { escrowEvent: "DELIVERY_FAILED", shouldAdvance: false };

    case "UNKNOWN":
    default:
      return { escrowEvent: null, shouldAdvance: false };
  }
}

/**
 * Fetches the current tracking status for a shipment directly from Shippo.
 * Used by: GET /shipping/track/:orderId
 *
 * @param {string} carrier         - Carrier token (e.g. "usps", "fedex", "ups")
 * @param {string} trackingNumber  - The tracking number from purchaseLabel()
 * @returns {object} Shippo tracking status object
 */
async function getTrackingStatus(carrier, trackingNumber) {
  const tracking = await shippo.trackingStatus.get(carrier, trackingNumber);

  return {
    carrier,
    trackingNumber,
    status: tracking.trackingStatus?.status ?? "UNKNOWN",
    substatus: tracking.trackingStatus?.substatus?.code ?? null,
    statusDetails: tracking.trackingStatus?.statusDetails ?? "",
    eta: tracking.eta ?? null,
    history: (tracking.trackingHistory ?? []).map((h) => ({
      status: h.status,
      location: h.location?.city
        ? `${h.location.city}, ${h.location.state}`
        : "Unknown",
      timestamp: h.statusDate,
    })),
    escrowEvent: mapToEscrowEvent(
      tracking.trackingStatus?.status ?? "UNKNOWN",
      tracking.trackingStatus?.substatus?.code ?? null
    ),
  };
}

module.exports = { mapToEscrowEvent, getTrackingStatus };
