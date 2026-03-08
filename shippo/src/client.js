const { Shippo } = require("shippo");

let _client = null;

function initClient(apiKey) {
  _client = new Shippo({ apiKeyHeader: apiKey });
}

function getClient() {
  if (!_client) {
    // Fallback for standalone usage
    require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
    if (!process.env.SHIPPO_KEY) throw new Error("SHIPPO_KEY missing");
    _client = new Shippo({ apiKeyHeader: process.env.SHIPPO_KEY });
  }
  return _client;
}

module.exports = { initClient, getClient };
