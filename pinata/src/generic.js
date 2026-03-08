const { getClient, gatewayUrl } = require("./client");

/**
 * Generic JSON pinning — pins arbitrary data to IPFS.
 * Used by the backend bridge's IPinataBridge.pinJSON() method.
 *
 * @param {unknown} data  - Any JSON-serializable object
 * @param {string}  name  - Human-readable name for the pin (stored in Pinata metadata)
 * @returns {Promise<string>} IPFS CID
 */
async function pinGenericJSON(data, name) {
  const pinata = getClient();
  const result = await pinata.upload
    .json(data)
    .addMetadata({ name, keyValues: { type: "generic_json" } });
  return result.cid;
}

/**
 * Generic file pinning — fetches a file from a URL and pins it to IPFS.
 * Used by the backend bridge's IPinataBridge.pinFile() method.
 *
 * @param {string} fileUrl  - URL to fetch the file from (e.g., Shippo label PDF URL)
 * @param {string} name     - Human-readable name for the pin
 * @returns {Promise<string>} IPFS CID
 */
async function pinGenericFile(fileUrl, name) {
  const fetch = require("node-fetch");
  const response = await fetch(fileUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch file from ${fileUrl}: ${response.status}`);
  }
  const buffer = await response.buffer();
  const file = new File([buffer], name, { type: "application/octet-stream" });
  const pinata = getClient();
  const result = await pinata.upload
    .file(file)
    .addMetadata({ name, keyValues: { type: "generic_file" } });
  return result.cid;
}

module.exports = { pinGenericJSON, pinGenericFile };
