const { PinataSDK } = require("pinata");

let _client = null;
let _gateway = null;

function initClient(jwt, gateway) {
  _client = new PinataSDK({ pinataJwt: jwt, pinataGateway: gateway });
  _gateway = gateway;
}

function getClient() {
  if (!_client) {
    // Fallback for standalone usage (pinata service run directly via node index.js)
    require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
    if (!process.env.PINATA_JWT) throw new Error("PINATA_JWT missing from .env — get it from app.pinata.cloud → API Keys");
    if (!process.env.PINATA_GATEWAY) throw new Error("PINATA_GATEWAY missing from .env — e.g. your-subdomain.mypinata.cloud");
    _client = new PinataSDK({
      pinataJwt: process.env.PINATA_JWT,
      pinataGateway: process.env.PINATA_GATEWAY,
    });
    _gateway = process.env.PINATA_GATEWAY;
  }
  return _client;
}

/**
 * Returns a public IPFS gateway URL for a given CID.
 * Stored in PostgreSQL and referenced on-chain.
 */
function gatewayUrl(cid) {
  if (!_gateway) getClient(); // ensure initialized
  return `https://${_gateway}/ipfs/${cid}`;
}

module.exports = { initClient, getClient, gatewayUrl };
