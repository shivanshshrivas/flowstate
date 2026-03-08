describe("pinGenericJSON", () => {
  let pinGenericJSON;
  let mockJsonFn;

  beforeEach(() => {
    vi.resetModules();
    mockJsonFn = vi.fn().mockReturnValue({
      addMetadata: vi.fn().mockResolvedValue({ cid: "QmGenericJson" }),
    });
    vi.doMock("../client", () => ({
      getClient: vi.fn(() => ({ upload: { json: mockJsonFn } })),
      gatewayUrl: vi.fn((cid) => `https://test.mypinata.cloud/ipfs/${cid}`),
    }));
    ({ pinGenericJSON } = require("../generic"));
  });

  it("returns the IPFS CID string", async () => {
    const cid = await pinGenericJSON({ key: "value" }, "test-pin");
    expect(cid).toBe("QmGenericJson");
  });

  it("passes data and name to Pinata upload", async () => {
    await pinGenericJSON({ orderId: "ord_001", event: "ESCROWED" }, "receipt_escrowed_ord_001");

    expect(mockJsonFn).toHaveBeenCalledWith({ orderId: "ord_001", event: "ESCROWED" });
    const metaCall = mockJsonFn.mock.results[0].value.addMetadata.mock.calls[0][0];
    expect(metaCall.name).toBe("receipt_escrowed_ord_001");
    expect(metaCall.keyValues.type).toBe("generic_json");
  });
});

describe("pinGenericFile", () => {
  let pinGenericFile;
  let mockFileFn;
  let nodeFetchMock;

  beforeEach(() => {
    vi.resetModules();
    mockFileFn = vi.fn().mockReturnValue({
      addMetadata: vi.fn().mockResolvedValue({ cid: "QmGenericFile" }),
    });
    nodeFetchMock = vi.fn().mockResolvedValue({
      ok: true,
      buffer: vi.fn().mockResolvedValue(Buffer.from("file-data")),
    });
    vi.doMock("../client", () => ({
      getClient: vi.fn(() => ({ upload: { file: mockFileFn } })),
      gatewayUrl: vi.fn((cid) => `https://test.mypinata.cloud/ipfs/${cid}`),
    }));
    vi.doMock("node-fetch", () => ({ default: nodeFetchMock }));
    ({ pinGenericFile } = require("../generic"));
  });

  it("returns the IPFS CID string", async () => {
    const cid = await pinGenericFile("https://example.com/file.pdf", "label_ord_001");
    expect(cid).toBe("QmGenericFile");
  });

  it("throws if fetch fails", async () => {
    nodeFetchMock.mockResolvedValueOnce({ ok: false, status: 500 });

    await expect(
      pinGenericFile("https://example.com/bad.pdf", "bad-file"),
    ).rejects.toThrow("Failed to fetch file");
  });
});
