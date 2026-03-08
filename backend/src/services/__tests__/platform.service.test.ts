import { describe, it, expect, vi, beforeEach } from "vitest";
import { PlatformService } from "../platform.service";

vi.mock("../../db/client", () => {
  const mockDb = Object.assign(vi.fn().mockResolvedValue([]), {
    json: (v: any) => v,
  });
  return { db: mockDb };
});

import { db } from "../../db/client";

describe("PlatformService", () => {
  let service: PlatformService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PlatformService();
  });

  describe("getAnalytics", () => {
    it("should return analytics with order counts and revenue", async () => {
      // Query 1: ordersByState
      (db as any).mockResolvedValueOnce([
        {
          state: "INITIATED",
          count: 5,
          totalUsd: "500.00",
          totalToken: "1000.000000000000000000",
        },
        {
          state: "FINALIZED",
          count: 3,
          totalUsd: "300.00",
          totalToken: "600.000000000000000000",
        },
      ]);
      // Query 2: sellerCounts
      (db as any).mockResolvedValueOnce([{ total: 10, active: 8 }]);
      // Query 3: disputeResult
      (db as any).mockResolvedValueOnce([{ count: 2 }]);

      const result = await service.getAnalytics("proj_1", 30);

      expect(result.orders.total).toBe(8);
      expect(result.sellers.total).toBe(10);
      expect(result.disputes.total).toBe(2);
    });
  });

  describe("getSellers", () => {
    it("should return sellers with dispute rates", async () => {
      (db as any).mockResolvedValueOnce([
        {
          id: "s1",
          businessName: "Shop A",
          walletAddress: "0x1",
          reputationScore: 100,
          isActive: true,
          orderCount: 100,
          disputeCount: 2,
        },
        {
          id: "s2",
          businessName: "Shop B",
          walletAddress: "0x2",
          reputationScore: 80,
          isActive: true,
          orderCount: 10,
          disputeCount: 3,
        },
      ]);

      const result = await service.getSellers("proj_1", false, 1, 20);

      expect(result.data).toHaveLength(2);
      expect(result.data[0].disputeRate).toBe(2);
    });

    it("should filter flagged sellers (>5% dispute rate)", async () => {
      (db as any).mockResolvedValueOnce([
        {
          id: "s1",
          businessName: "Good Shop",
          walletAddress: "0x1",
          reputationScore: 100,
          isActive: true,
          orderCount: 100,
          disputeCount: 1,
        },
        {
          id: "s2",
          businessName: "Bad Shop",
          walletAddress: "0x2",
          reputationScore: 50,
          isActive: true,
          orderCount: 10,
          disputeCount: 3,
        },
      ]);

      const result = await service.getSellers("proj_1", true, 1, 20);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].businessName).toBe("Bad Shop");
    });
  });

  describe("getGasCosts", () => {
    it("should return gas cost estimates", async () => {
      (db as any).mockResolvedValueOnce([
        { state: "LABEL_CREATED", count: 10 },
        { state: "SHIPPED", count: 8 },
      ]);

      const result = await service.getGasCosts("proj_1");

      expect(result.totalTransactions).toBe(18);
      expect(parseFloat(result.estimatedTotalGasXrp)).toBeGreaterThan(0);
    });
  });
});
