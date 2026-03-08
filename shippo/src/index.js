const { getShippingRates } = require("./rates");
const { purchaseLabel, pinLabelToIPFS } = require("./labels");
const { getTrackingStatus, mapToEscrowEvent } = require("./tracking");
const { handleShippoWebhook } = require("./webhook");

let _initialized = false;

function initialize(apiKey) {
  const { initClient } = require("./client");
  initClient(apiKey);
  _initialized = true;
}

module.exports = {
  initialize,
  getShippingRates,
  purchaseLabel,
  pinLabelToIPFS,
  getTrackingStatus,
  mapToEscrowEvent,
  handleShippoWebhook,
};
