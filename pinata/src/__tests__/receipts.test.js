describe("pinTrackingReceipt", () => {
  let pinTrackingReceipt;
  let mockUploadJson;

  beforeEach(() => {
    vi.resetModules();
    process.env.PINATA_JWT = "test-jwt";
    process.env.PINATA_GATEWAY = "test-gateway.mypinata.cloud";
    mockUploadJson = vi.fn().mockReturnValue({
      addMetadata: vi.fn().mockResolvedValue({ cid: "QmReceiptCid" }),
    });
    vi.doMock("pinata", () => ({
      PinataSDK: vi.fn().mockImplementation(() => ({
        upload: { json: mockUploadJson },
      })),
    }));
    ({ pinTrackingReceipt } = require("../receipts"));
  });

  it("returns cid, url, and receipt object", async () => {
    const result = await pinTrackingReceipt({
      orderId: "ord_001",
      fromState: "SHIPPED",
      toState: "IN_TRANSIT",
      escrowEvent: "IN_TRANSIT",
      trackingNumber: "TRACK123",
      carrier: "USPS",
      shippoStatus: "TRANSIT",
      statusDetails: "In transit to destination",
      onChainTxHash: "0xtx",
      payoutBps: 2000,
    });

    expect(result).toHaveProperty("cid", "QmReceiptCid");
    expect(result).toHaveProperty("url");
    expect(result.receipt.escrow.payoutBasisPoints).toBe(2000);
    expect(result.receipt.receiptType).toBe("tracking_state_transition");
  });

  it("embeds chain ID 1449000 (XRPL EVM testnet)", async () => {
    const result = await pinTrackingReceipt({
      orderId: "ord_002",
      fromState: "IN_TRANSIT",
      toState: "DELIVERED",
      escrowEvent: "DELIVERED",
      trackingNumber: "T999",
      carrier: "FedEx",
      shippoStatus: "DELIVERED",
      statusDetails: "Delivered",
      onChainTxHash: "0xdel",
      payoutBps: 3500,
    });

    expect(result.receipt.escrow.chainId).toBe(1449000);
  });
});

describe("pinPayoutReceipt", () => {
  let pinPayoutReceipt;
  let mockUploadJson;

  beforeEach(() => {
    vi.resetModules();
    process.env.PINATA_JWT = "test-jwt";
    process.env.PINATA_GATEWAY = "test-gateway.mypinata.cloud";
    mockUploadJson = vi.fn().mockReturnValue({
      addMetadata: vi.fn().mockResolvedValue({ cid: "QmPayoutCid" }),
    });
    vi.doMock("pinata", () => ({
      PinataSDK: vi.fn().mockImplementation(() => ({
        upload: { json: mockUploadJson },
      })),
    }));
    ({ pinPayoutReceipt } = require("../receipts"));
  });

  it("returns cid, url, and payout receipt", async () => {
    const result = await pinPayoutReceipt({
      orderId: "ord_001",
      escrowState: "LABEL_CREATED",
      sellerWallet: "0xSeller",
      amountToken: "30000000000000000000",
      token: "FLUSD",
      onChainTxHash: "0xtx",
    });

    expect(result).toHaveProperty("cid", "QmPayoutCid");
    expect(result.receipt.receiptType).toBe("payout");
    expect(result.receipt.payout.sellerWallet).toBe("0xSeller");
  });

  it("includes platformFeeTaken when provided", async () => {
    const result = await pinPayoutReceipt({
      orderId: "ord_002",
      escrowState: "FINALIZED",
      sellerWallet: "0xSeller",
      amountToken: "14625000000000000000",
      token: "FLUSD",
      onChainTxHash: "0xfinal",
      platformFeeTaken: "375000000000000000",
    });

    expect(result.receipt.payout.platformFeeTaken).toBe("375000000000000000");
  });
});
