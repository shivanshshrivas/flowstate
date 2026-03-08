const { getClient, gatewayUrl } = require("./client");

/**
 * Pins state transition proof receipts to IPFS.
 *
 * Architecture flow (line 323):
 *   Tracking updates | Carrier → Shippo → Backend webhook | HTTPS POST
 *   Stored In: PostgreSQL + IPFS proof + on-chain state
 *
 * Sequence (lines 990–998):
 *   Backend receives Shippo webhook → pins transit proof JSON to Pinata
 *   → passes proof_cid to EscrowFSM.advanceState(orderId, newState, proof_cid)
 *
 * Called by:
 *   POST /orders/:id/confirm-label-printed  → label print receipt
 *   POST /shipping/webhook/shippo           → tracking transition receipt
 */

/**
 * Pins a tracking/state transition receipt.
 *
 * @param {object} params
 * @param {string} params.orderId
 * @param {string} params.fromState
 * @param {string} params.toState
 * @param {string} params.escrowEvent
 * @param {string} params.trackingNumber
 * @param {string} params.carrier
 * @param {string} params.shippoStatus
 * @param {string} params.statusDetails
 * @param {string} params.onChainTxHash
 * @param {number} params.payoutBps       - Basis points released (1500 = 15%)
 * @returns {{ cid, url, receipt }}
 */
async function pinTrackingReceipt({
  orderId, fromState, toState, escrowEvent,
  trackingNumber, carrier, shippoStatus, statusDetails,
  onChainTxHash, payoutBps,
}) {
  const pinata = getClient();
  const receipt = {
    receiptVersion: "1.0",
    receiptType: "tracking_state_transition",
    orderId,
    timestamp: new Date().toISOString(),
    escrow: {
      fromState,
      toState,
      event: escrowEvent,
      onChainTxHash,
      payoutBasisPoints: payoutBps,
      network: "XRPL EVM Testnet",
      chainId: 1449000,
    },
    shipping: { carrier, trackingNumber, shippoStatus, statusDetails },
  };

  const result = await pinata.upload
    .json(receipt)
    .addMetadata({
      name: `receipt-${orderId}-${toState}`,
      keyValues: { orderId, fromState, toState, type: "tracking_receipt" },
    });

  const cid = result.cid;
  return { cid, url: gatewayUrl(cid), receipt };
}

/**
 * Pins a payout receipt — proof that tokens were released.
 *
 * @param {object} params
 * @param {string} params.orderId
 * @param {string} params.escrowState
 * @param {string} params.sellerWallet
 * @param {string} params.amountToken
 * @param {string} params.token
 * @param {string} params.onChainTxHash
 * @param {string} [params.platformFeeTaken]
 * @returns {{ cid, url, receipt }}
 */
async function pinPayoutReceipt({
  orderId, escrowState, sellerWallet,
  amountToken, token, onChainTxHash, platformFeeTaken,
}) {
  const pinata = getClient();
  const receipt = {
    receiptVersion: "1.0",
    receiptType: "payout",
    orderId,
    timestamp: new Date().toISOString(),
    payout: {
      triggerState: escrowState,
      sellerWallet,
      amountToken,
      token,
      platformFeeTaken: platformFeeTaken ?? null,
      onChainTxHash,
      network: "XRPL EVM Testnet",
      chainId: 1449000,
    },
  };

  const result = await pinata.upload
    .json(receipt)
    .addMetadata({
      name: `payout-${orderId}-${escrowState}`,
      keyValues: { orderId, escrowState, type: "payout_receipt" },
    });

  const cid = result.cid;
  return { cid, url: gatewayUrl(cid), receipt };
}

module.exports = { pinTrackingReceipt, pinPayoutReceipt };
