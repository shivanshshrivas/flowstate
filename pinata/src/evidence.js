const { getClient, gatewayUrl } = require("./client");

/**
 * Pins dispute evidence to IPFS.
 *
 * Architecture flow (line 325):
 *   Dispute evidence | Buyer upload → Backend → Pinata IPFS | HTTPS + Pinata SDK | IPFS (CID on-chain)
 *
 * Called by:
 *   POST /disputes/create       → buyer submits evidence
 *   POST /disputes/:id/respond  → seller submits counter-evidence
 *
 * The returned CID is passed to DisputeResolver.sol:
 *   createDispute(orderId, evidenceCid)   — buyer
 *   respondToDispute(disputeId, evidenceCid) — seller
 */

/**
 * Pins a single evidence file (image, PDF, etc.) to IPFS.
 *
 * @param {Buffer} fileBuffer
 * @param {string} filename
 * @param {string} mimeType
 * @param {string} disputeId
 * @returns {{ cid, url, filename }}
 */
async function pinEvidenceFile(fileBuffer, filename, mimeType, disputeId) {
  const pinata = getClient();
  const file = new File([fileBuffer], filename, { type: mimeType });

  const result = await pinata.upload
    .file(file)
    .addMetadata({
      name: `evidence-${disputeId}-${filename}`,
      keyValues: { disputeId, type: "dispute_evidence_file" },
    });

  const cid = result.cid;
  return { cid, url: gatewayUrl(cid), filename };
}

/**
 * Pins a complete evidence bundle (metadata + attachment CIDs) to IPFS.
 * This bundle CID is what gets recorded on-chain in DisputeResolver.sol.
 *
 * @param {object} params
 * @param {string} params.disputeId
 * @param {string} params.orderId
 * @param {"buyer"|"seller"} params.submittedBy
 * @param {string} params.description
 * @param {Array<{filename, cid, url}>} params.attachments
 * @returns {{ cid, url, bundle }}
 */
async function pinEvidenceBundle({ disputeId, orderId, submittedBy, description, attachments }) {
  const pinata = getClient();
  const bundle = {
    bundleVersion: "1.0",
    disputeId,
    orderId,
    submittedBy,
    submittedAt: new Date().toISOString(),
    description,
    attachments: attachments.map((a) => ({
      filename: a.filename,
      cid: a.cid,
      url: a.url,
    })),
  };

  const result = await pinata.upload
    .json(bundle)
    .addMetadata({
      name: `evidence-bundle-${disputeId}-${submittedBy}`,
      keyValues: { disputeId, orderId, submittedBy, type: "dispute_evidence_bundle" },
    });

  const cid = result.cid;
  return { cid, url: gatewayUrl(cid), bundle };
}

module.exports = { pinEvidenceFile, pinEvidenceBundle };
