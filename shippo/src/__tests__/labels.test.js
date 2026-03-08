/**
 * purchaseLabel tests
 *
 * Uses require.cache injection (not vi.mock) because vi.mock's ESM registry
 * does not intercept require() calls inside CJS source files.
 */

const path = require("path");

const CLIENT_PATH = path.resolve(__dirname, "../client.js");
const LABELS_PATH = path.resolve(__dirname, "../labels.js");

const mockTransaction = {
  status: "SUCCESS",
  objectId: "txn_abc123",
  trackingNumber: "9400111899560334140922",
  trackingUrlProvider: "https://tools.usps.com/go/TrackConfirmAction?tLabels=9400111899560334140922",
  rate: { provider: "USPS", amount: "7.50" },
  labelUrl: "https://shippo-delivery.s3.amazonaws.com/label.pdf",
};

describe("purchaseLabel", () => {
  let mockCreate;

  beforeEach(() => {
    mockCreate = vi.fn();

    // Inject mock client into Node's CJS module cache
    delete require.cache[LABELS_PATH];
    delete require.cache[CLIENT_PATH];
    require.cache[CLIENT_PATH] = {
      id: CLIENT_PATH, filename: CLIENT_PATH, loaded: true,
      exports: { getClient: () => ({ transactions: { create: mockCreate } }) },
    };
  });

  afterEach(() => {
    delete require.cache[CLIENT_PATH];
    delete require.cache[LABELS_PATH];
    vi.clearAllMocks();
  });

  it("returns all label fields including shippingCostUsd on success", async () => {
    mockCreate.mockResolvedValue(mockTransaction);
    const { purchaseLabel } = require("../labels");

    const result = await purchaseLabel("rate_001");

    expect(result).toEqual({
      transactionId: "txn_abc123",
      trackingNumber: "9400111899560334140922",
      trackingUrlProvider: "https://tools.usps.com/go/TrackConfirmAction?tLabels=9400111899560334140922",
      carrier: "USPS",
      labelUrl: "https://shippo-delivery.s3.amazonaws.com/label.pdf",
      labelIpfsCid: null,
      shippingCostUsd: "7.50",
    });
  });

  it("passes rateObjectId and PDF format to the SDK", async () => {
    mockCreate.mockResolvedValue(mockTransaction);
    const { purchaseLabel } = require("../labels");

    await purchaseLabel("rate_001");

    expect(mockCreate).toHaveBeenCalledWith({
      rate: "rate_001",
      labelFileType: "PDF",
      async: false,
    });
  });

  it("defaults carrier and shippingCostUsd when rate is absent", async () => {
    mockCreate.mockResolvedValue({ ...mockTransaction, rate: null });
    const { purchaseLabel } = require("../labels");

    const result = await purchaseLabel("rate_002");
    expect(result.carrier).toBe("unknown");
    expect(result.shippingCostUsd).toBe("0");
  });

  it("throws with message text when transaction fails", async () => {
    mockCreate.mockResolvedValue({
      status: "ERROR",
      messages: [{ text: "Invalid rate ID" }, { text: "Rate expired" }],
    });
    const { purchaseLabel } = require("../labels");

    await expect(purchaseLabel("rate_bad")).rejects.toThrow("Invalid rate ID; Rate expired");
  });

  it("throws with status when messages are empty", async () => {
    mockCreate.mockResolvedValue({ status: "WAITING", messages: [] });
    const { purchaseLabel } = require("../labels");

    await expect(purchaseLabel("rate_bad")).rejects.toThrow("Label purchase failed: WAITING");
  });
});
