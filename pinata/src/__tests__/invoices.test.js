describe("pinInvoice", () => {
  let pinInvoice;
  let mockUploadFile;
  let mockUploadJson;

  beforeEach(() => {
    vi.resetModules();
    process.env.PINATA_JWT = "test-jwt";
    process.env.PINATA_GATEWAY = "test-gateway.mypinata.cloud";
    mockUploadFile = vi.fn().mockReturnValue({
      addMetadata: vi.fn().mockResolvedValue({ cid: "QmPdfCid123" }),
    });
    mockUploadJson = vi.fn().mockReturnValue({
      addMetadata: vi.fn().mockResolvedValue({ cid: "QmJsonCid456" }),
    });
    vi.doMock("pinata", () => ({
      PinataSDK: vi.fn().mockImplementation(() => ({
        upload: { file: mockUploadFile, json: mockUploadJson },
      })),
    }));
    vi.doMock("fs", () => ({
      readFileSync: vi.fn(() => Buffer.from("fake-pdf-data")),
    }));
    ({ pinInvoice } = require("../invoices"));
  });

  it("returns pdfCid, jsonCid, pdfUrl, jsonUrl", async () => {
    const result = await pinInvoice("/tmp/invoice.pdf", {
      orderId: "ord_001",
      buyer: "0xBuyer",
      seller: "0xSeller",
      items: [{ name: "Widget", qty: 1 }],
      shipping: { carrier: "USPS", cost: "5.99" },
      escrow: { txHash: "0xtx", amount: "100" },
      platformFeeUSD: "2.50",
    });

    expect(result).toHaveProperty("pdfCid", "QmPdfCid123");
    expect(result).toHaveProperty("jsonCid", "QmJsonCid456");
    expect(result.pdfUrl).toContain("QmPdfCid123");
    expect(result.jsonUrl).toContain("QmJsonCid456");
  });

  it("pins PDF first, then JSON with pdfCid embedded", async () => {
    await pinInvoice("/tmp/invoice.pdf", { orderId: "ord_002" });

    expect(mockUploadFile).toHaveBeenCalledOnce();
    expect(mockUploadJson).toHaveBeenCalledOnce();
    const jsonArg = mockUploadJson.mock.calls[0][0];
    expect(jsonArg.invoicePdfCid).toBe("QmPdfCid123");
  });
});
