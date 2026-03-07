import { describe, it, expect, vi, beforeEach } from "vitest";
import { DisputeService } from "../dispute.service";
import {
  createMockPinataBridge,
  createMockBlockchainBridge,
} from "../../__tests__/helpers/mocks";
import { makeOrder, makeDispute } from "../../__tests__/helpers/fixtures";

vi.mock("../../db/client", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  },
}));

vi.mock("../../events/emitter", () => ({
  flowStateEmitter: {
    emit: vi.fn(),
    on: vi.fn(),
    once: vi.fn(),
    setMaxListeners: vi.fn(),
  },
}));

vi.mock("../../utils/id-generator", () => ({
  generateId: {
    dispute: vi.fn().mockReturnValue("fs_dis_test123"),
  },
}));

import { db } from "../../db/client";
import { flowStateEmitter } from "../../events/emitter";

describe("DisputeService", () => {
  let service: DisputeService;
  let pinataBridge: ReturnType<typeof createMockPinataBridge>;
  let blockchainBridge: ReturnType<typeof createMockBlockchainBridge>;

  beforeEach(() => {
    vi.clearAllMocks();
    pinataBridge = createMockPinataBridge();
    blockchainBridge = createMockBlockchainBridge();
    service = new DisputeService(pinataBridge, blockchainBridge);
  });

  describe("create", () => {
    it("should create a dispute on a DELIVERED order within grace period", async () => {
      const order = makeOrder({
        state: "DELIVERED",
        escrowAmountToken: "200.000000000000000000",
        escrowContractOrderId: "contract_ord_1",
        graceEndsAt: new Date(Date.now() + 60 * 60 * 1000),
      });
      (db.limit as any).mockResolvedValueOnce([order]);

      const dispute = makeDispute({ id: "fs_dis_test123", orderId: order.id });
      (db.returning as any).mockResolvedValueOnce([dispute]);

      const result = await service.create(order.projectId, {
        orderId: order.id,
        reason: "Not as described",
        evidenceUrls: ["https://evidence.example.com/photo.jpg"],
      });

      expect(result.disputeId).toBe("fs_dis_test123");
      expect(result.frozenAmountToken).toBe("200.000000000000000000");
      expect(blockchainBridge.initiateDispute).toHaveBeenCalled();
      expect(flowStateEmitter.emit).toHaveBeenCalledWith(
        "dispute:created",
        expect.any(Object),
      );
    });

    it("should throw 409 if order not DELIVERED", async () => {
      const order = makeOrder({ state: "SHIPPED" });
      (db.limit as any).mockResolvedValueOnce([order]);

      await expect(
        service.create(order.projectId, {
          orderId: order.id,
          reason: "Broken",
          evidenceUrls: [],
        }),
      ).rejects.toThrow("Disputes can only be opened on DELIVERED orders");
    });

    it("should throw 409 if grace period expired", async () => {
      const order = makeOrder({
        state: "DELIVERED",
        graceEndsAt: new Date(Date.now() - 1000),
      });
      (db.limit as any).mockResolvedValueOnce([order]);

      await expect(
        service.create(order.projectId, {
          orderId: order.id,
          reason: "Broken",
          evidenceUrls: [],
        }),
      ).rejects.toThrow("Grace period has expired");
    });
  });

  describe("respond", () => {
    it("should accept dispute and refund buyer", async () => {
      const dispute = makeDispute({ status: "OPEN" });
      (db.limit as any).mockResolvedValueOnce([dispute]);
      const order = makeOrder({
        id: dispute.orderId,
        escrowContractOrderId: "contract_ord_1",
      });
      (db.limit as any).mockResolvedValueOnce([order]);

      const result = await service.respond(dispute.id, order.projectId, {
        action: "accept" as const,
      });

      expect(result.status).toBe("RESOLVED_BUYER");
      expect(blockchainBridge.resolveDispute).toHaveBeenCalled();
      expect(blockchainBridge.refundBuyer).toHaveBeenCalled();
    });

    it("should contest dispute with seller evidence", async () => {
      const dispute = makeDispute({ status: "OPEN" });
      (db.limit as any).mockResolvedValueOnce([dispute]);
      const order = makeOrder({ id: dispute.orderId });
      (db.limit as any).mockResolvedValueOnce([order]);

      const result = await service.respond(dispute.id, order.projectId, {
        action: "contest" as const,
        evidenceUrls: ["https://evidence.example.com/proof.jpg"],
      });

      expect(result.status).toBe("SELLER_RESPONDED");
      expect(result.reviewDeadline).toBeDefined();
      expect(blockchainBridge.respondToDispute).toHaveBeenCalled();
    });

    it("should throw 409 if dispute not OPEN", async () => {
      const dispute = makeDispute({ status: "RESOLVED_BUYER" });
      (db.limit as any).mockResolvedValueOnce([dispute]);
      const order = makeOrder({ id: dispute.orderId });
      (db.limit as any).mockResolvedValueOnce([order]);

      await expect(
        service.respond(dispute.id, order.projectId, {
          action: "accept" as const,
        }),
      ).rejects.toThrow("Cannot respond to dispute in status RESOLVED_BUYER");
    });
  });

  describe("resolve", () => {
    it("should resolve dispute with refund resolution", async () => {
      const dispute = makeDispute({ status: "SELLER_RESPONDED" });
      (db.limit as any).mockResolvedValueOnce([dispute]);
      const order = makeOrder({ id: dispute.orderId });
      (db.limit as any).mockResolvedValueOnce([order]);

      const result = await service.resolve(dispute.id, order.projectId, {
        resolution: "refund" as const,
      });

      expect(result.status).toBe("RESOLVED_BUYER");
      expect(blockchainBridge.resolveDispute).toHaveBeenCalledWith(
        dispute.contractDisputeId,
        "refund",
        undefined,
      );
      expect(flowStateEmitter.emit).toHaveBeenCalledWith(
        "dispute:resolved",
        expect.any(Object),
      );
    });

    it("should resolve dispute with split resolution", async () => {
      const dispute = makeDispute({ status: "SELLER_RESPONDED" });
      (db.limit as any).mockResolvedValueOnce([dispute]);
      const order = makeOrder({ id: dispute.orderId });
      (db.limit as any).mockResolvedValueOnce([order]);

      const result = await service.resolve(dispute.id, order.projectId, {
        resolution: "split" as const,
        splitBps: 5000,
      });

      expect(result.status).toBe("RESOLVED_SPLIT");
      expect(blockchainBridge.resolveDispute).toHaveBeenCalledWith(
        dispute.contractDisputeId,
        "split",
        5000,
      );
    });
  });
});
