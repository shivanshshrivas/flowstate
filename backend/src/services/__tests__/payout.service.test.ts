import { describe, it, expect, vi, beforeEach } from "vitest";
import { PayoutService } from "../payout.service";
import { makePayout } from "../../__tests__/helpers/fixtures";

vi.mock("../../db/client", () => {
  const mockDb = Object.assign(vi.fn().mockResolvedValue([]), {
    json: (v: any) => v,
  });
  return { db: mockDb };
});

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
    payout: vi.fn().mockReturnValue("fs_pay_test123"),
  },
}));

import { db } from "../../db/client";
import { flowStateEmitter } from "../../events/emitter";

describe("PayoutService", () => {
  let service: PayoutService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PayoutService();
  });

  describe("recordPayout", () => {
    it("should insert a payout record and emit event", async () => {
      const payout = makePayout();
      (db as any).mockResolvedValueOnce([payout]); // insert ... returning *
      (db as any).mockResolvedValueOnce([{ projectId: "proj_1" }]); // select project_id from orders

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
      (db as any).mockResolvedValueOnce(payouts);            // select * from payouts
      (db as any).mockResolvedValueOnce([{ count: "2" }]);  // select count(*)

      const result = await service.getSellerPayouts("fs_sel_test", 1, 20);

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
    });
  });
});
