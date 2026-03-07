require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const { Shippo } = require("shippo");

if (!process.env.SHIPPO_KEY) {
  throw new Error("SHIPPO_KEY missing from .env");
}

const shippo = new Shippo({ apiKeyHeader: process.env.SHIPPO_KEY });

module.exports = { shippo };
