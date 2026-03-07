const { shippo } = require("./client");

/**
 * Purchases a shipping label for the selected rate.
 *
 * Called by: POST /orders/:id/select-shipping
 * After purchase, the label PDF URL is pinned to Pinata IPFS (stub below).
 * The returned CID is stored in PostgreSQL and referenced on-chain.
 *
 * Escrow trigger: purchasing the label advances state to LABEL_CREATED → 15% payout.
 *
 * @param {string} rateObjectId - The objectId of the rate the buyer selected
 * @returns {object} label info including tracking number and PDF URL
 */
async function purchaseLabel(rateObjectId) {
  const transaction = await shippo.transactions.create({
    rate: rateObjectId,
    labelFileType: "PDF",
    async: false,
  });

  if (transaction.status !== "SUCCESS") {
    const messages = transaction.messages?.map((m) => m.text).join("; ");
    throw new Error(`Label purchase failed: ${messages || transaction.status}`);
  }

  const label = {
    transactionId: transaction.objectId,
    trackingNumber: transaction.trackingNumber,
    trackingUrlProvider: transaction.trackingUrlProvider,
    carrier: transaction.rate?.provider ?? "unknown",
    labelUrl: transaction.labelUrl,   // PDF download URL from Shippo
    labelIpfsCid: null,               // filled in by pinLabelToIPFS()
  };

  // Pin the label PDF to Pinata IPFS.
  // TODO: wire up real Pinata SDK once that module is built.
  // label.labelIpfsCid = await pinLabelToIPFS(label.labelUrl, orderId);

  return label;
}

/**
 * Stub: pin a label PDF to Pinata IPFS.
 * Real implementation will:
 *   1. Fetch PDF from labelUrl
 *   2. Call pinata.pinFileToIPFS()
 *   3. Return the CID
 *   4. Store CID in PostgreSQL orders table
 *   5. Emit CID on-chain via EscrowFSM.advanceState()
 */
async function pinLabelToIPFS(labelUrl, orderId) {
  console.log(`[stub] Would pin label for order ${orderId} to IPFS: ${labelUrl}`);
  return "QmStubCid000000000000000000000000000000000000";
}

module.exports = { purchaseLabel, pinLabelToIPFS };
