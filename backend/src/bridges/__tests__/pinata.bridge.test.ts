import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../../pinata/src", () => ({
  initialize: vi.fn(),
  pinGenericJSON: vi.fn(),
  pinGenericFile: vi.fn(),
  getGatewayUrl: vi.fn(),
}));

vi.mock("../../config/env", () => ({
  env: {
    PINATA_JWT: "env_test_jwt",
    PINATA_GATEWAY: "env-test.mypinata.cloud",
  },
}));

import * as pinataLib from "../../../../pinata/src";
import { PinataBridgeImpl } from "../pinata.bridge";

describe("PinataBridgeImpl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("calls initialize with provided jwt and gateway", () => {
      new PinataBridgeImpl("explicit_jwt", "explicit.mypinata.cloud");
      expect(pinataLib.initialize).toHaveBeenCalledWith(
        "explicit_jwt",
        "explicit.mypinata.cloud"
      );
    });

    it("falls back to env vars when no credentials provided", () => {
      new PinataBridgeImpl();
      expect(pinataLib.initialize).toHaveBeenCalledWith(
        "env_test_jwt",
        "env-test.mypinata.cloud"
      );
    });
  });

  describe("pinJSON", () => {
    it("delegates to pinataLib.pinGenericJSON and returns CID", async () => {
      vi.mocked(pinataLib.pinGenericJSON).mockResolvedValue("QmTestCID123");

      const bridge = new PinataBridgeImpl("jwt", "gateway");
      const data = { orderId: "fs_ord_1", amount: "100" };
      const result = await bridge.pinJSON(data, "invoice_fs_ord_1");

      expect(pinataLib.pinGenericJSON).toHaveBeenCalledWith(data, "invoice_fs_ord_1");
      expect(result).toBe("QmTestCID123");
    });
  });

  describe("pinFile", () => {
    it("delegates to pinataLib.pinGenericFile and returns CID", async () => {
      vi.mocked(pinataLib.pinGenericFile).mockResolvedValue("QmFileCID456");

      const bridge = new PinataBridgeImpl("jwt", "gateway");
      const result = await bridge.pinFile("https://labels.example.com/label.pdf", "label_fs_ord_1");

      expect(pinataLib.pinGenericFile).toHaveBeenCalledWith(
        "https://labels.example.com/label.pdf",
        "label_fs_ord_1"
      );
      expect(result).toBe("QmFileCID456");
    });
  });

  describe("getGatewayUrl", () => {
    it("delegates to pinataLib.getGatewayUrl", () => {
      vi.mocked(pinataLib.getGatewayUrl).mockReturnValue(
        "https://test.mypinata.cloud/ipfs/QmTestCID123"
      );

      const bridge = new PinataBridgeImpl("jwt", "gateway");
      const result = bridge.getGatewayUrl("QmTestCID123");

      expect(pinataLib.getGatewayUrl).toHaveBeenCalledWith("QmTestCID123");
      expect(result).toBe("https://test.mypinata.cloud/ipfs/QmTestCID123");
    });
  });
});
