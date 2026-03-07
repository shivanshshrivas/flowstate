/**
 * FlowState × Pinata — IPFS Pinning Service (Sandbox)
 *
 * Express server with endpoints matching the FlowState architecture.
 * Each endpoint pins content to Pinata IPFS and returns the CID + gateway URL.
 *
 * Endpoints:
 *   POST /orders/:id/confirm-escrow          → pins invoice PDF + JSON
 *   POST /orders/:id/select-shipping         → pins label PDF (from Shippo URL)
 *   POST /orders/:id/confirm-label-printed   → pins label-printed receipt
 *   POST /shipping/webhook/shippo            → pins tracking proof receipt
 *   POST /disputes/create                    → pins buyer evidence (file upload)
 *   POST /disputes/:id/respond               → pins seller counter-evidence
 *   GET  /ipfs/:cid                          → redirects to Pinata gateway
 *
 * Run: node index.js
 */

require("dotenv").config();

const express = require("express");
const multer = require("multer");
const path = require("path");
const { gatewayUrl } = require("./src/client");
const { pinInvoice } = require("./src/invoices");
const { pinShippingLabel } = require("./src/labels");
const { pinEvidenceFile, pinEvidenceBundle } = require("./src/evidence");
const { pinTrackingReceipt, pinPayoutReceipt } = require("./src/receipts");

const app = express();
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

const PORT = process.env.PORT || 3002;

// Path to the test PDF uploaded by the user
const TEST_PDF = path.join(__dirname, "src", "Manish_statement.pdf");

// ───────────────────────────────────────────────────────────────────────────
// POST /orders/:id/confirm-escrow
//
// Architecture: Backend generates invoice → pins PDF + JSON to Pinata
// Sequence:     lines 921–934 in architecture.md
//
// For testing: uses Manish_statement.pdf as the invoice PDF.
// In production: backend generates the invoice PDF from order data.
//
// Body: { buyer, seller, items[], shipping, escrow, platformFeeUSD }
// Returns: { pdfCid, jsonCid, pdfUrl, jsonUrl }
// ───────────────────────────────────────────────────────────────────────────
app.post("/orders/:id/confirm-escrow", async (req, res) => {
  try {
    const orderId = req.params.id;
    const orderData = {
      orderId,
      buyer: req.body.buyer || {
        name: "Test Buyer",
        email: "buyer@example.com",
        address: "1 MetroTech Center, Brooklyn, NY 11201",
      },
      seller: req.body.seller || {
        name: "Demo Seller",
        email: "seller@flowstate.xyz",
        walletAddress: "0xSellerWallet0001",
      },
      items: req.body.items || [
        { name: "Wireless Headphones", quantity: 1, priceUSD: 39.99 },
      ],
      shipping: req.body.shipping || {
        carrier: "USPS",
        service: "Priority Mail",
        amountUSD: "5.50",
      },
      escrow: req.body.escrow || {
        txHash: "0xMockEscrowTx0001",
        contractAddress: "0xEscrowFSMAddr0001",
        amountToken: "45.52",
        token: "MockRLUSD",
      },
      platformFeeUSD: req.body.platformFeeUSD || "1.14",
    };

    console.log(`[confirm-escrow] Pinning invoice for order ${orderId}...`);

    const result = await pinInvoice(TEST_PDF, orderData);

    console.log(`[confirm-escrow] Invoice PDF CID: ${result.pdfCid}`);
    console.log(`[confirm-escrow] Invoice JSON CID: ${result.jsonCid}`);

    // In production:
    // → UPDATE orders SET invoice_cid = jsonCid WHERE id = orderId
    // → EscrowFSM.setInvoiceCID(orderId, jsonCid)

    res.json({
      orderId,
      status: "ESCROWED",
      invoice: result,
    });
  } catch (err) {
    console.error("[confirm-escrow] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// POST /orders/:id/select-shipping
//
// Architecture: Shippo → Backend → Pinata IPFS
// Sequence:     lines 843–846 in architecture.md
//
// Body: { labelUrl, trackingNumber }
// Returns: { cid, url }
// ───────────────────────────────────────────────────────────────────────────
app.post("/orders/:id/select-shipping", async (req, res) => {
  try {
    const orderId = req.params.id;
    const { labelUrl, trackingNumber } = req.body;

    if (!labelUrl) {
      return res.status(400).json({ error: "labelUrl is required (from Shippo transaction)" });
    }

    console.log(`[select-shipping] Pinning label PDF for order ${orderId}...`);

    const result = await pinShippingLabel(labelUrl, orderId, trackingNumber || "UNKNOWN");

    console.log(`[select-shipping] Label CID: ${result.cid}`);

    // In production:
    // → UPDATE orders SET label_cid = cid WHERE id = orderId

    res.json({
      orderId,
      label: result,
    });
  } catch (err) {
    console.error("[select-shipping] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// POST /orders/:id/confirm-label-printed
//
// Architecture: Seller confirms label printed → pin receipt → advanceState
// Sequence:     lines 665–671 in architecture.md
//
// Body: { sellerWallet }
// Returns: { receiptCid, receiptUrl }
// ───────────────────────────────────────────────────────────────────────────
app.post("/orders/:id/confirm-label-printed", async (req, res) => {
  try {
    const orderId = req.params.id;
    const sellerWallet = req.body.sellerWallet || "0xSellerWallet0001";

    console.log(`[confirm-label-printed] Pinning receipt for order ${orderId}...`);

    const receipt = await pinTrackingReceipt({
      orderId,
      fromState: "ESCROWED",
      toState: "LABEL_CREATED",
      escrowEvent: "LABEL_CREATED",
      trackingNumber: req.body.trackingNumber || "SHIPPO_TEST_001",
      carrier: req.body.carrier || "usps",
      shippoStatus: "PRE_TRANSIT",
      statusDetails: "Label printed and confirmed by seller",
      onChainTxHash: "0xPending_advanceState_tx",
      payoutBps: 1500, // 15%
    });

    console.log(`[confirm-label-printed] Receipt CID: ${receipt.cid}`);

    // In production:
    // → EscrowFSM.advanceState(orderId, LABEL_CREATED, receipt_cid) → 15% payout
    // → PaymentSplitter.releasePartial(orderId, 15%) → seller wallet

    res.json({
      orderId,
      status: "LABEL_CREATED",
      payoutPercent: "15%",
      receipt: { cid: receipt.cid, url: receipt.url },
    });
  } catch (err) {
    console.error("[confirm-label-printed] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// POST /shipping/webhook/shippo
//
// Architecture: Carrier → Shippo → Backend webhook
// Sequence:     lines 990–998 in architecture.md
//
// Body: Shippo webhook payload { event, data: { tracking_number, tracking_status } }
// Returns: { handled, receipt }
// ───────────────────────────────────────────────────────────────────────────
app.post("/shipping/webhook/shippo", async (req, res) => {
  try {
    const payload = req.body;

    if (payload.event !== "track_updated") {
      return res.json({ handled: false, reason: `Ignored event: ${payload.event}` });
    }

    const data = payload.data;
    const status = data?.tracking_status?.status || "UNKNOWN";
    const trackingNumber = data?.tracking_number;
    const carrier = data?.carrier;

    if (!trackingNumber || !carrier) {
      return res.status(400).json({ error: "Missing tracking_number or carrier" });
    }

    // Map Shippo status → escrow state
    const stateMap = {
      TRANSIT: { from: "LABEL_CREATED", to: "SHIPPED", bps: 1500 },
      DELIVERED: { from: "IN_TRANSIT", to: "DELIVERED", bps: 7000 },
    };

    const mapping = stateMap[status];

    if (!mapping) {
      console.log(`[shippo-webhook] ${carrier} ${trackingNumber}: ${status} (no state advance)`);
      return res.json({ handled: true, escrowAdvance: false, status });
    }

    console.log(`[shippo-webhook] ${carrier} ${trackingNumber}: ${status} → ${mapping.to}`);

    const receipt = await pinTrackingReceipt({
      orderId: data.order_id || "unknown",
      fromState: mapping.from,
      toState: mapping.to,
      escrowEvent: mapping.to,
      trackingNumber,
      carrier,
      shippoStatus: status,
      statusDetails: data.tracking_status?.status_details || "",
      onChainTxHash: "0xPending_advanceState_tx",
      payoutBps: mapping.bps,
    });

    console.log(`[shippo-webhook] Proof CID: ${receipt.cid}`);

    // In production:
    // → EscrowFSM.advanceState(orderId, newState, proof_cid)
    // → PaymentSplitter payout triggered

    res.json({
      handled: true,
      escrowAdvance: true,
      toState: mapping.to,
      payoutBps: mapping.bps,
      receipt: { cid: receipt.cid, url: receipt.url },
    });
  } catch (err) {
    console.error("[shippo-webhook] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// POST /disputes/create
//
// Architecture: Buyer upload → Backend → Pinata IPFS
// Sequence:     Buyer uploads evidence files + description
//
// Multipart form: files (evidence), orderId, description
// Returns: { disputeId, bundleCid, bundleUrl }
// ───────────────────────────────────────────────────────────────────────────
app.post("/disputes/create", upload.array("evidence", 5), async (req, res) => {
  try {
    const orderId = req.body.orderId;
    const description = req.body.description || "Dispute filed by buyer";
    const disputeId = `dispute_${orderId}_${Date.now()}`;

    if (!orderId) {
      return res.status(400).json({ error: "orderId is required" });
    }

    console.log(`[disputes/create] Filing dispute ${disputeId} for order ${orderId}...`);

    // Pin each uploaded evidence file
    const attachments = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const pinned = await pinEvidenceFile(
          file.buffer,
          file.originalname,
          file.mimetype,
          disputeId
        );
        attachments.push(pinned);
        console.log(`[disputes/create] Evidence file pinned: ${pinned.filename} → ${pinned.cid}`);
      }
    }

    // Pin the evidence bundle (metadata + all file CIDs)
    const bundle = await pinEvidenceBundle({
      disputeId,
      orderId,
      submittedBy: "buyer",
      description,
      attachments,
    });

    console.log(`[disputes/create] Bundle CID: ${bundle.cid}`);

    // In production:
    // → DisputeResolver.createDispute(orderId, bundle.cid)
    // → CID stored on-chain permanently

    res.json({
      disputeId,
      orderId,
      bundleCid: bundle.cid,
      bundleUrl: bundle.url,
      evidenceFiles: attachments.map((a) => ({ filename: a.filename, cid: a.cid, url: a.url })),
    });
  } catch (err) {
    console.error("[disputes/create] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// POST /disputes/:id/respond
//
// Architecture: Seller submits counter-evidence
//
// Multipart form: files (evidence), orderId, description
// Returns: { disputeId, bundleCid, bundleUrl }
// ───────────────────────────────────────────────────────────────────────────
app.post("/disputes/:id/respond", upload.array("evidence", 5), async (req, res) => {
  try {
    const disputeId = req.params.id;
    const orderId = req.body.orderId || "unknown";
    const description = req.body.description || "Response from seller";

    console.log(`[disputes/respond] Seller responding to dispute ${disputeId}...`);

    const attachments = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const pinned = await pinEvidenceFile(
          file.buffer,
          file.originalname,
          file.mimetype,
          disputeId
        );
        attachments.push(pinned);
        console.log(`[disputes/respond] Evidence file pinned: ${pinned.filename} → ${pinned.cid}`);
      }
    }

    const bundle = await pinEvidenceBundle({
      disputeId,
      orderId,
      submittedBy: "seller",
      description,
      attachments,
    });

    console.log(`[disputes/respond] Bundle CID: ${bundle.cid}`);

    // In production:
    // → DisputeResolver.respondToDispute(disputeId, bundle.cid)

    res.json({
      disputeId,
      orderId,
      bundleCid: bundle.cid,
      bundleUrl: bundle.url,
      evidenceFiles: attachments.map((a) => ({ filename: a.filename, cid: a.cid, url: a.url })),
    });
  } catch (err) {
    console.error("[disputes/respond] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// GET /ipfs/:cid
//
// Convenience redirect to Pinata gateway for any pinned CID.
// ───────────────────────────────────────────────────────────────────────────
app.get("/ipfs/:cid", (req, res) => {
  res.redirect(gatewayUrl(req.params.cid));
});

// ───────────────────────────────────────────────────────────────────────────
// Start
// ───────────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`FlowState Pinata IPFS service running on http://localhost:${PORT}`);
  console.log(`Gateway: ${process.env.PINATA_GATEWAY}`);
  console.log();
  console.log("Endpoints:");
  console.log(`  POST /orders/:id/confirm-escrow          → pin invoice PDF + JSON`);
  console.log(`  POST /orders/:id/select-shipping         → pin label PDF from Shippo`);
  console.log(`  POST /orders/:id/confirm-label-printed   → pin receipt JSON`);
  console.log(`  POST /shipping/webhook/shippo            → pin tracking proof`);
  console.log(`  POST /disputes/create                    → pin buyer evidence (multipart)`);
  console.log(`  POST /disputes/:id/respond               → pin seller evidence (multipart)`);
  console.log(`  GET  /ipfs/:cid                          → redirect to gateway`);
  console.log();
  console.log(`Test invoice PDF: ${TEST_PDF}`);
});
