require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const { PinataSDK } = require("pinata");

if (!process.env.PINATA_JWT) {
  throw new Error("PINATA_JWT missing from .env — get it from app.pinata.cloud → API Keys");
}

if (!process.env.PINATA_GATEWAY) {
  throw new Error("PINATA_GATEWAY missing from .env — e.g. your-subdomain.mypinata.cloud");
}

const pinata = new PinataSDK({
  pinataJwt: process.env.PINATA_JWT,
  pinataGateway: process.env.PINATA_GATEWAY,
});

/**
 * Returns a public IPFS gateway URL for a given CID.
 * Stored in PostgreSQL and referenced on-chain.
 */
function gatewayUrl(cid) {
  return `https://${process.env.PINATA_GATEWAY}/ipfs/${cid}`;
}

module.exports = { pinata, gatewayUrl };
