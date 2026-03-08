vi.mock("pinata", () => ({
  PinataSDK: vi.fn().mockImplementation(() => ({})),
}));

describe("client", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.PINATA_JWT;
    delete process.env.PINATA_GATEWAY;
  });

  it("initClient sets up the SDK instance", () => {
    const { initClient, getClient } = require("../client");
    initClient("test-jwt", "test.mypinata.cloud");
    const client = getClient();
    expect(client).toBeDefined();
  });

  it("getClient throws if PINATA_JWT missing from env (no init)", () => {
    vi.resetModules();
    delete process.env.PINATA_JWT;
    const { getClient } = require("../client");
    expect(() => getClient()).toThrow("PINATA_JWT missing");
  });

  it("gatewayUrl returns correct https URL for a CID", () => {
    const { initClient, gatewayUrl } = require("../client");
    initClient("jwt", "my-gateway.mypinata.cloud");
    const url = gatewayUrl("Qm123abc");
    expect(url).toBe("https://my-gateway.mypinata.cloud/ipfs/Qm123abc");
  });
});
