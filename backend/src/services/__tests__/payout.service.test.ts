import { describe, it, expect, vi, beforeEach } from "vitest";
import { PayoutService } from "../payout.service";
import { makePayout } from "../../__tests__/helpers/fixtures";

const resultQueue: any[] = [];
let insertResult: any[] = [];

vi.mock("../../db/client", () => {
  function createChainableProxy(): any {
    const handler: ProxyHandler<object> = {
      get(_target, prop) {
        if (prop === "then") {
          const result = resultQueue.shift() ?? [];
          return (resolve: any) => resolve(result);
        }
        if (prop === "insert") {
          // insert -> values -> returning chain
          return vi.fn().mockImplementation(() => ({
            values: vi.fn().mockImplementation(() => ({
              returning: vi
                .fn()
                .mockImplementation(() => Promise.resolve(insertResult)),
            })),
          }));
        }
        return vi.fn().mockImplementation(() => createChainableProxy());
      },
    };
    return new Proxy({}, handler);
  }
  return { db: createChainableProxy() };
});

vi.mock("../../events/emitter", () => ({
  flowStateEmitter: {
    emit: vi.fn(),
    on: vi.fn(),
    once: vi.fn(),
    setMaxListeners: vi.fn(),
  },
}));

import { flowStateEmitter } from "../../events/emitter";

describe("PayoutService", () => {
  let service: PayoutService;

  beforeEach(() => {
    vi.clearAllMocks();
    resultQueue.length = 0;
    insertResult = [];
    service = new PayoutService();
  });

  describe("recordPayout", () => {
    it("should insert a payout record and emit event", async () => {
      const payout = makePayout();
      insertResult = [payout];

      const result = await service.recordPayout({
        orderId: payout.orderId,
        sellerId: payout.sellerId,
        state: "LABEL_CREATED",
        escrowAmountToken: "200.000000000000000000",
        percentageBps: 1500,
        txHash: "0xtx",
        receiptIpfsCid: "QmReceipt",
      });

      expect(result.id).toBeDefined();
      expect(flowStateEmitter.emit).toHaveBeenCalledWith(
        "payout:recorded",
        expect.objectContaining({
          payoutId: payout.id,
          orderId: payout.orderId,
        }),
      );
    });
  });

  describe("getSellerPayouts", () => {
    it("should return paginated payouts", async () => {
      const payouts = [makePayout(), makePayout()];
      // First query: data (select.from.where.orderBy.limit.offset)
      resultQueue.push(payouts);
      // Second query: count (select.from.where)
      resultQueue.push(payouts);

      const result = await service.getSellerPayouts("fs_sel_test", 1, 20);

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
    });
  });
});
