const { shippo } = require("./client");

/**
 * Fetches shipping rates for a given shipment.
 *
 * Called by: GET /shipping/rates  and  POST /orders/create (checkout overlay)
 * Result is cached in Redis with a short TTL (see architecture).
 *
 * @param {object} fromAddress - Seller's warehouse address
 * @param {object} toAddress   - Buyer's delivery address
 * @param {object} parcel      - Package dimensions and weight
 * @returns {object} shipment  - Full Shippo shipment object; .rates[] has the options
 */
async function getShippingRates(fromAddress, toAddress, parcel) {
  const shipment = await shippo.shipments.create({
    addressFrom: fromAddress,
    addressTo: toAddress,
    parcels: [parcel],
    async: false, // wait for rates synchronously
  });

  if (shipment.status !== "SUCCESS") {
    throw new Error(`Shipment creation failed: ${shipment.status}`);
  }

  // Return only the fields the frontend needs to render the shipping selector
  const rates = shipment.rates.map((r) => ({
    rateId: r.objectId,
    carrier: r.provider,
    service: r.servicelevel.name,
    days: r.estimatedDays,
    amountUSD: r.amount,
    currency: r.currency,
  }));

  return { shipmentId: shipment.objectId, rates };
}

module.exports = { getShippingRates };
