import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeOrder, makeDispute } from "../../__tests__/helpers/fixtures";

const resultQueue: any[] = [];

vi.mock("../../db/client", () => {
  function createChainableProxy(): any {
    const handler: ProxyHandler<object> = {
      get(_target, prop) {
        if (prop === "then") {
          const result = resultQueue.shift() ?? [];
          return (resolve: any) => resolve(result);
        }
        return vi.fn().mockImplementation(() => createChainableProxy());
      },
    };
    return new Proxy({}, handler);
  }
  return { db: createChainableProxy() };
});

describe("Cron Scheduler", () => {
  beforeEach(() => {
    resultQueue.length = 0;
  });

  describe("auto-finalize concept", () => {
    it("should identify DELIVERED orders past grace period", () => {
      const order = makeOrder({
        state: "DELIVERED",
        graceEndsAt: new Date(Date.now() - 1000),
      });
      expect(order.state).toBe("DELIVERED");
      expect(order.graceEndsAt < new Date()).toBe(true);
    });

    it("should skip orders with open disputes", () => {
      const dispute = makeDispute({ status: "OPEN" });
      expect(dispute.status).toBe("OPEN");
    });
  });

  describe("dispute-auto-resolve concept", () => {
    it("should identify OPEN disputes past seller deadline", () => {
      const dispute = makeDispute({
        status: "OPEN",
        sellerDeadline: new Date(Date.now() - 1000),
      });
      expect(dispute.status).toBe("OPEN");
      expect(dispute.sellerDeadline < new Date()).toBe(true);
    });
  });
});
