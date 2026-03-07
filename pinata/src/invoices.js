const fs = require("fs");
const path = require("path");
const { pinata, gatewayUrl } = require("./client");

/**
 * Pins an invoice PDF file to IPFS.
 *
 * Architecture flow (line 321):
 *   Invoice PDF | Backend → Pinata IPFS | Pinata SDK | IPFS (CID in PostgreSQL + on-chain)
 *
 * Sequence (lines 921–929):
 *   Backend generates invoice JSON + PDF → pins both to Pinata → returns invoice_cid
 *   → CID stored in PostgreSQL orders.invoice_cid
 *   → CID set on-chain via EscrowFSM.setInvoiceCID(orderId, cid)
 *
 * Called by: POST /orders/:id/confirm-escrow
 *
 * @param {string} pdfPath   - Absolute path to the invoice PDF file
 * @param {object} orderData - Order metadata to pin as JSON alongside the PDF
 * @returns {{ pdfCid, jsonCid, pdfUrl, jsonUrl }}
 */
async function pinInvoice(pdfPath, orderData) {
  // 1. Pin the invoice PDF
  const pdfBuffer = fs.readFileSync(pdfPath);
  const pdfFile = new File(
    [pdfBuffer],
    `invoice-${orderData.orderId}.pdf`,
    { type: "application/pdf" }
  );

  const pdfResult = await pinata.upload
    .file(pdfFile)
    .addMetadata({
      name: `invoice-pdf-${orderData.orderId}`,
      keyValues: { orderId: orderData.orderId, type: "invoice_pdf" },
    });

  const pdfCid = pdfResult.cid;

  // 2. Pin the invoice JSON (structured metadata for on-chain reference)
  const invoiceJson = {
    invoiceVersion: "1.0",
    orderId: orderData.orderId,
    issuedAt: new Date().toISOString(),
    buyer: orderData.buyer,
    seller: orderData.seller,
    items: orderData.items,
    shipping: orderData.shipping,
    escrow: orderData.escrow,
    platformFeeUSD: orderData.platformFeeUSD,
    invoicePdfCid: pdfCid,
    invoicePdfUrl: gatewayUrl(pdfCid),
  };

  const jsonResult = await pinata.upload
    .json(invoiceJson)
    .addMetadata({
      name: `invoice-json-${orderData.orderId}`,
      keyValues: { orderId: orderData.orderId, type: "invoice_json" },
    });

  const jsonCid = jsonResult.cid;

  return {
    pdfCid,
    jsonCid,
    pdfUrl: gatewayUrl(pdfCid),
    jsonUrl: gatewayUrl(jsonCid),
  };
}

module.exports = { pinInvoice };
