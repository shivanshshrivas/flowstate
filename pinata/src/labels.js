const fetch = require("node-fetch");
const { pinata, gatewayUrl } = require("./client");

/**
 * Fetches a shipping label PDF from Shippo and pins it to IPFS.
 *
 * Architecture flow (line 322):
 *   Shipping label | Shippo → Backend → Pinata IPFS | Shippo SDK → Pinata SDK | IPFS (CID in PostgreSQL)
 *
 * Sequence (lines 843–846):
 *   Backend purchases label from Shippo → gets label_pdf URL
 *   → fetches PDF → pins to Pinata → returns label_cid
 *   → CID stored in PostgreSQL orders.label_cid
 *   → CID emitted in EscrowFSM LABEL_CREATED event
 *
 * Called by: POST /orders/:id/select-shipping
 *
 * @param {string} labelUrl       - PDF URL from Shippo transaction.labelUrl
 * @param {string} orderId        - FlowState order ID
 * @param {string} trackingNumber - From Shippo transaction
 * @returns {{ cid, url }}
 */
async function pinShippingLabel(labelUrl, orderId, trackingNumber) {
  const response = await fetch(labelUrl);

  if (!response.ok) {
    throw new Error(`Failed to fetch label PDF from Shippo: ${response.status}`);
  }

  const buffer = await response.buffer();
  const file = new File([buffer], `label-${orderId}.pdf`, { type: "application/pdf" });

  const result = await pinata.upload
    .file(file)
    .addMetadata({
      name: `label-${orderId}`,
      keyValues: { orderId, trackingNumber, type: "shipping_label" },
    });

  const cid = result.cid;
  return { cid, url: gatewayUrl(cid) };
}

module.exports = { pinShippingLabel };
