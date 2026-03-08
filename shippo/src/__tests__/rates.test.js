/**
 * getShippingRates tests
 *
 * Uses require.cache injection (not vi.mock) because vi.mock's ESM registry
 * does not intercept require() calls inside CJS source files.
 */

const path = require("path");

const CLIENT_PATH = path.resolve(__dirname, "../client.js");
const RATES_PATH  = path.resolve(__dirname, "../rates.js");

const mockShipment = {
  status: "SUCCESS",
  objectId: "shp_abc123",
  rates: [
    { objectId: "rate_001", provider: "USPS", servicelevel: { name: "Priority Mail" }, estimatedDays: 3,    amount: "7.50",  currency: "USD" },
    { objectId: "rate_002", provider: "FedEx", servicelevel: { name: "Ground" },       estimatedDays: null, amount: "12.00", currency: "USD" },
  ],
};

const fromAddress = { name: "Seller", street1: "1 Warehouse Rd", city: "Austin", state: "TX", zip: "78701", country: "US" };
const toAddress   = { name: "Buyer",  street1: "2 Main St",      city: "Denver", state: "CO", zip: "80201", country: "US" };
const parcel      = { length: 10, width: 8, height: 4, distanceUnit: "in", weight: 2, massUnit: "lb" };

describe("getShippingRates", () => {
  let mockCreate;

  beforeEach(() => {
    mockCreate = vi.fn();

    // Inject mock client into Node's CJS module cache
    delete require.cache[RATES_PATH];
    delete require.cache[CLIENT_PATH];
    require.cache[CLIENT_PATH] = {
      id: CLIENT_PATH, filename: CLIENT_PATH, loaded: true,
      exports: { getClient: () => ({ shipments: { create: mockCreate } }) },
    };
  });

  afterEach(() => {
    delete require.cache[CLIENT_PATH];
    delete require.cache[RATES_PATH];
    vi.clearAllMocks();
  });

  it("returns shipmentId and mapped rates on success", async () => {
    mockCreate.mockResolvedValue(mockShipment);
    const { getShippingRates } = require("../rates");

    const result = await getShippingRates(fromAddress, toAddress, parcel);

    expect(result.shipmentId).toBe("shp_abc123");
    expect(result.rates).toHaveLength(2);
    expect(result.rates[0]).toEqual({ rateId: "rate_001", carrier: "USPS",  service: "Priority Mail", days: 3,    amountUSD: "7.50",  currency: "USD" });
    expect(result.rates[1]).toEqual({ rateId: "rate_002", carrier: "FedEx", service: "Ground",        days: null, amountUSD: "12.00", currency: "USD" });
  });

  it("passes addresses and parcel directly to the Shippo SDK", async () => {
    mockCreate.mockResolvedValue(mockShipment);
    const { getShippingRates } = require("../rates");

    await getShippingRates(fromAddress, toAddress, parcel);

    expect(mockCreate).toHaveBeenCalledWith({
      addressFrom: fromAddress,
      addressTo: toAddress,
      parcels: [parcel],
      async: false,
    });
  });

  it("throws when shipment status is not SUCCESS", async () => {
    mockCreate.mockResolvedValue({ status: "ERROR" });
    const { getShippingRates } = require("../rates");

    await expect(getShippingRates(fromAddress, toAddress, parcel)).rejects.toThrow(
      "Shipment creation failed: ERROR"
    );
  });
});
