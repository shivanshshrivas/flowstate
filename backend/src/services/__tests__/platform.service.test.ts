import { describe, it, expect, vi, beforeEach } from "vitest";
import { PlatformService } from "../platform.service";

// Use a queue-based approach: terminal methods pop results from a queue.
const resultQueue: any[] = [];

vi.mock("../../db/client", () => {
  // Create a Proxy that acts as both a chainable builder and a thenable.
  // When awaited, it pops the next result from the queue.
  function createChainableProxy(): any {
    const handler: ProxyHandler<object> = {
      get(_target, prop) {
        if (prop === "then") {
          // Make it thenable - when awaited, pop from result queue
          const result = resultQueue.shift() ?? [];
          return (resolve: any) => resolve(result);
        }
        // All other properties return a function that returns the proxy
        return vi.fn().mockImplementation(() => createChainableProxy());
      },
    };
    return new Proxy({}, handler);
  }
  return { db: createChainableProxy() };
});

describe("PlatformService", () => {
  let service: PlatformService;

  beforeEach(() => {
    resultQueue.length = 0;
    service = new PlatformService();
  });

  describe("getAnalytics", () => {
    it("should return analytics with order counts and revenue", async () => {
      // Query 1: ordersByState
      resultQueue.push([
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
      resultQueue.push([{ total: 10, active: 8 }]);
      // Query 3: disputeResult
      resultQueue.push([{ count: 2 }]);

      const result = await service.getAnalytics("proj_1", 30);

      expect(result.orders.total).toBe(8);
      expect(result.sellers.total).toBe(10);
      expect(result.disputes.total).toBe(2);
    });
  });

  describe("getSellers", () => {
    it("should return sellers with dispute rates", async () => {
      resultQueue.push([
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
      resultQueue.push([
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
      resultQueue.push([
        { state: "LABEL_CREATED", count: 10 },
        { state: "SHIPPED", count: 8 },
      ]);

      const result = await service.getGasCosts("proj_1");

      expect(result.totalTransactions).toBe(18);
      expect(parseFloat(result.estimatedTotalGasXrp)).toBeGreaterThan(0);
    });
  });
});
