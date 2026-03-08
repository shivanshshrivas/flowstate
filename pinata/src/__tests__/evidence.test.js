describe("pinEvidenceFile", () => {
  let pinEvidenceFile;
  let mockUploadFile;

  beforeEach(() => {
    vi.resetModules();
    process.env.PINATA_JWT = "test-jwt";
    process.env.PINATA_GATEWAY = "test-gateway.mypinata.cloud";
    mockUploadFile = vi.fn().mockReturnValue({
      addMetadata: vi.fn().mockResolvedValue({ cid: "QmEvidenceFile" }),
    });
    vi.doMock("pinata", () => ({
      PinataSDK: vi.fn().mockImplementation(() => ({
        upload: { file: mockUploadFile, json: vi.fn() },
      })),
    }));
    ({ pinEvidenceFile } = require("../evidence"));
  });

  it("returns cid, url, and filename", async () => {
    const result = await pinEvidenceFile(
      Buffer.from("fake-image-data"),
      "damage.jpg",
      "image/jpeg",
      "dispute_001",
    );

    expect(result).toHaveProperty("cid", "QmEvidenceFile");
    expect(result).toHaveProperty("url");
    expect(result).toHaveProperty("filename", "damage.jpg");
  });

  it("tags with disputeId and type in metadata", async () => {
    await pinEvidenceFile(Buffer.from("data"), "receipt.pdf", "application/pdf", "dispute_002");

    const metaCall = mockUploadFile.mock.results[0].value.addMetadata.mock.calls[0][0];
    expect(metaCall.keyValues.disputeId).toBe("dispute_002");
    expect(metaCall.keyValues.type).toBe("dispute_evidence_file");
  });
});

describe("pinEvidenceBundle", () => {
  let pinEvidenceBundle;
  let mockUploadJson;

  beforeEach(() => {
    vi.resetModules();
    process.env.PINATA_JWT = "test-jwt";
    process.env.PINATA_GATEWAY = "test-gateway.mypinata.cloud";
    mockUploadJson = vi.fn().mockReturnValue({
      addMetadata: vi.fn().mockResolvedValue({ cid: "QmEvidenceBundle" }),
    });
    vi.doMock("pinata", () => ({
      PinataSDK: vi.fn().mockImplementation(() => ({
        upload: { file: vi.fn(), json: mockUploadJson },
      })),
    }));
    ({ pinEvidenceBundle } = require("../evidence"));
  });

  it("returns cid, url, and bundle with attachments", async () => {
    const result = await pinEvidenceBundle({
      disputeId: "dispute_001",
      orderId: "ord_001",
      submittedBy: "buyer",
      description: "Item arrived damaged",
      attachments: [
        { filename: "photo.jpg", cid: "QmPhoto", url: "https://gw/ipfs/QmPhoto" },
      ],
    });

    expect(result).toHaveProperty("cid", "QmEvidenceBundle");
    expect(result.bundle.submittedBy).toBe("buyer");
    expect(result.bundle.attachments).toHaveLength(1);
    expect(result.bundle.attachments[0].cid).toBe("QmPhoto");
  });

  it("bundles metadata for on-chain reference", async () => {
    await pinEvidenceBundle({
      disputeId: "dispute_003",
      orderId: "ord_003",
      submittedBy: "seller",
      description: "Proof of delivery",
      attachments: [],
    });

    const jsonArg = mockUploadJson.mock.calls[0][0];
    expect(jsonArg.bundleVersion).toBe("1.0");
    expect(jsonArg.disputeId).toBe("dispute_003");
  });
});
