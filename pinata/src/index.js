const { pinInvoice } = require("./invoices");
const { pinShippingLabel } = require("./labels");
const { pinTrackingReceipt, pinPayoutReceipt } = require("./receipts");
const { pinEvidenceFile, pinEvidenceBundle } = require("./evidence");
const { pinGenericJSON, pinGenericFile } = require("./generic");

let _initialized = false;

function initialize(jwt, gateway) {
  const { initClient } = require("./client");
  initClient(jwt, gateway);
  _initialized = true;
}

function getGatewayUrl(cid) {
  const { gatewayUrl } = require("./client");
  return gatewayUrl(cid);
}

module.exports = {
  initialize,
  pinInvoice,
  pinShippingLabel,
  pinTrackingReceipt,
  pinPayoutReceipt,
  pinEvidenceFile,
  pinEvidenceBundle,
  pinGenericJSON,
  pinGenericFile,
  getGatewayUrl,
};
