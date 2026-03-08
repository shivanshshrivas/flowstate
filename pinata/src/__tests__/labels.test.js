describe("pinShippingLabel", () => {
  let pinShippingLabel;
  let mockFileFn;
  let nodeFetchMock;

  beforeEach(() => {
    vi.resetModules();
    mockFileFn = vi.fn().mockReturnValue({
      addMetadata: vi.fn().mockResolvedValue({ cid: "QmLabelCid789" }),
    });
    nodeFetchMock = vi.fn().mockResolvedValue({
      ok: true,
      buffer: vi.fn().mockResolvedValue(Buffer.from("fake-label-pdf")),
    });
    vi.doMock("../client", () => ({
      getClient: vi.fn(() => ({ upload: { file: mockFileFn } })),
      gatewayUrl: vi.fn((cid) => `https://test.mypinata.cloud/ipfs/${cid}`),
    }));
    vi.doMock("node-fetch", () => ({ default: nodeFetchMock }));
    ({ pinShippingLabel } = require("../labels"));
  });

  it("returns cid and url", async () => {
    const result = await pinShippingLabel(
      "https://shippo.api/labels/label.pdf",
      "ord_001",
      "TRACK123",
    );

    expect(result).toHaveProperty("cid", "QmLabelCid789");
    expect(result.url).toContain("QmLabelCid789");
  });

  it("pins with correct metadata including orderId and trackingNumber", async () => {
    await pinShippingLabel("https://example.com/label.pdf", "ord_002", "TRACK456");

    expect(mockFileFn).toHaveBeenCalledOnce();
    const metadataArg = mockFileFn.mock.results[0].value.addMetadata.mock.calls[0][0];
    expect(metadataArg.keyValues.orderId).toBe("ord_002");
    expect(metadataArg.keyValues.trackingNumber).toBe("TRACK456");
    expect(metadataArg.keyValues.type).toBe("shipping_label");
  });

  it("throws if fetch fails", async () => {
    nodeFetchMock.mockResolvedValueOnce({ ok: false, status: 404 });

    await expect(
      pinShippingLabel("https://example.com/bad.pdf", "ord_003", "T000"),
    ).rejects.toThrow("Failed to fetch label PDF from Shippo: 404");
  });
});
