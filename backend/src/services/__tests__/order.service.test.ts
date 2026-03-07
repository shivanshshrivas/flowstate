import { describe, it, expect, vi, beforeEach } from "vitest";
import { OrderService } from "../order.service";
import {
  createMockShippoBridge,
  createMockPinataBridge,
  createMockBlockchainBridge,
} from "../../__tests__/helpers/mocks";
import { makeOrder, makeSeller } from "../../__tests__/helpers/fixtures";

// Mock the DB module
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
    order: vi.fn().mockReturnValue("fs_ord_test123"),
    payout: vi.fn().mockReturnValue("fs_pay_test123"),
  },
}));

import { db } from "../../db/client";
import { flowStateEmitter } from "../../events/emitter";

describe("OrderService", () => {
  let service: OrderService;
  let shippoBridge: ReturnType<typeof createMockShippoBridge>;
  let pinataBridge: ReturnType<typeof createMockPinataBridge>;
  let blockchainBridge: ReturnType<typeof createMockBlockchainBridge>;
  let payoutService: any;

  beforeEach(() => {
    vi.clearAllMocks();
    shippoBridge = createMockShippoBridge();
    pinataBridge = createMockPinataBridge();
    blockchainBridge = createMockBlockchainBridge();
    payoutService = { recordPayout: vi.fn().mockResolvedValue({}) };
    service = new OrderService(
      shippoBridge,
      pinataBridge,
      blockchainBridge,
      payoutService,
    );
  });

  describe("create", () => {
    it("should create an order with shipping rates", async () => {
      const seller = makeSeller({ projectId: "proj_1" });
      (db.limit as any).mockResolvedValueOnce([seller]);

      const result = await service.create("proj_1", {
        items: [{ name: "Widget", quantity: 1, unitPriceUsd: 50 }],
        sellerId: seller.id,
        buyerWallet: "0xBuyer",
        sellerWallet: "0xSeller",
        addressFrom: {
          name: "A",
          street1: "1 St",
          city: "NYC",
          state: "NY",
          zip: "10001",
          country: "US",
        },
        addressTo: {
          name: "B",
          street1: "2 St",
          city: "LA",
          state: "CA",
          zip: "90001",
          country: "US",
        },
        parcel: {
          length: 10,
          width: 8,
          height: 4,
          distanceUnit: "in" as const,
          weight: 2,
          massUnit: "lb" as const,
        },
      });

      expect(result.orderId).toBe("fs_ord_test123");
      expect(result.shippingOptions).toBeDefined();
      expect(result.subtotalUsd).toBe(50);
      expect(shippoBridge.getRates).toHaveBeenCalledOnce();
      expect(db.insert).toHaveBeenCalled();
    });

    it("should throw 404 if seller not found", async () => {
      (db.limit as any).mockResolvedValueOnce([]);

      await expect(
        service.create("proj_1", {
          items: [{ name: "Widget", quantity: 1, unitPriceUsd: 50 }],
          sellerId: "fs_sel_nonexistent",
          buyerWallet: "0xBuyer",
          sellerWallet: "0xSeller",
          addressFrom: {
            name: "A",
            street1: "1 St",
            city: "NYC",
            state: "NY",
            zip: "10001",
            country: "US",
          },
          addressTo: {
            name: "B",
            street1: "2 St",
            city: "LA",
            state: "CA",
            zip: "90001",
            country: "US",
          },
          parcel: {
            length: 10,
            width: 8,
            height: 4,
            distanceUnit: "in" as const,
            weight: 2,
            massUnit: "lb" as const,
          },
        }),
      ).rejects.toThrow("Seller not found");
    });
  });

  describe("selectShipping", () => {
    it("should purchase label and return escrow amount", async () => {
      const order = makeOrder({ state: "INITIATED", subtotalUsd: "100.00" });
      (db.limit as any).mockResolvedValueOnce([order]);

      const result = await service.selectShipping(order.id, order.projectId, {
        rateId: "rate_1",
      });

      expect(result.escrowAmountToken).toBeDefined();
      expect(result.labelCid).toBeDefined();
      expect(shippoBridge.purchaseLabel).toHaveBeenCalledWith("rate_1");
      expect(pinataBridge.pinFile).toHaveBeenCalled();
    });

    it("should throw 409 if order not in INITIATED state", async () => {
      const order = makeOrder({ state: "ESCROWED" });
      (db.limit as any).mockResolvedValueOnce([order]);

      await expect(
        service.selectShipping(order.id, order.projectId, { rateId: "rate_1" }),
      ).rejects.toThrow("Cannot select shipping in state ESCROWED");
    });

    it("should throw 404 if order not found", async () => {
      (db.limit as any).mockResolvedValueOnce([]);

      await expect(
        service.selectShipping("fs_ord_none", "proj_1", { rateId: "rate_1" }),
      ).rejects.toThrow("Order not found");
    });
  });

  describe("confirmEscrow", () => {
    it("should verify deposit and transition to ESCROWED", async () => {
      const order = makeOrder({
        state: "INITIATED",
        escrowAmountToken: "200.000000000000000000",
      });
      (db.limit as any).mockResolvedValueOnce([order]);
      (db.returning as any).mockResolvedValueOnce([
        { ...order, state: "ESCROWED" },
      ]);

      const result = await service.confirmEscrow(order.id, order.projectId, {
        txHash: "0xtxhash",
      });

      expect(result.status).toBe("ESCROWED");
      expect(result.invoiceCid).toBeDefined();
      expect(blockchainBridge.verifyEscrowDeposit).toHaveBeenCalled();
      expect(pinataBridge.pinJSON).toHaveBeenCalled();
      expect(flowStateEmitter.emit).toHaveBeenCalledWith(
        "order:state_changed",
        expect.any(Object),
      );
    });

    it("should throw 400 if shipping not selected (no escrowAmountToken)", async () => {
      const order = makeOrder({ state: "INITIATED", escrowAmountToken: null });
      (db.limit as any).mockResolvedValueOnce([order]);

      await expect(
        service.confirmEscrow(order.id, order.projectId, { txHash: "0xtx" }),
      ).rejects.toThrow("Shipping must be selected");
    });

    it("should throw 400 if escrow deposit not verified", async () => {
      const order = makeOrder({
        state: "INITIATED",
        escrowAmountToken: "200.000000000000000000",
      });
      (db.limit as any).mockResolvedValueOnce([order]);
      (blockchainBridge.verifyEscrowDeposit as any).mockResolvedValueOnce({
        verified: false,
        contractOrderId: "",
      });

      await expect(
        service.confirmEscrow(order.id, order.projectId, { txHash: "0xbadtx" }),
      ).rejects.toThrow("Escrow deposit could not be verified");
    });

    it("should throw 409 if order not in INITIATED state", async () => {
      const order = makeOrder({ state: "ESCROWED" });
      (db.limit as any).mockResolvedValueOnce([order]);

      await expect(
        service.confirmEscrow(order.id, order.projectId, { txHash: "0xtx" }),
      ).rejects.toThrow("Cannot confirm escrow");
    });
  });

  describe("confirmLabelPrinted", () => {
    it("should advance to LABEL_CREATED and release 15%", async () => {
      const order = makeOrder({
        state: "ESCROWED",
        sellerWallet: "0xSeller",
        escrowAmountToken: "200.000000000000000000",
        escrowContractOrderId: "contract_ord_1",
      });
      (db.limit as any).mockResolvedValueOnce([order]);
      (db.returning as any).mockResolvedValueOnce([
        { ...order, state: "LABEL_CREATED" },
      ]);

      const result = await service.confirmLabelPrinted(
        order.id,
        order.projectId,
        {
          sellerWallet: "0xSeller",
        },
      );

      expect(result.status).toBe("LABEL_CREATED");
      expect(result.payoutAmountToken).toBeDefined();
      expect(blockchainBridge.advanceState).toHaveBeenCalled();
      expect(blockchainBridge.releasePartial).toHaveBeenCalledWith(
        "contract_ord_1",
        1500,
      );
      expect(payoutService.recordPayout).toHaveBeenCalled();
      expect(flowStateEmitter.emit).toHaveBeenCalledWith(
        "order:state_changed",
        expect.any(Object),
      );
    });

    it("should throw 403 if wallet mismatch", async () => {
      const order = makeOrder({ state: "ESCROWED", sellerWallet: "0xSeller" });
      (db.limit as any).mockResolvedValueOnce([order]);

      await expect(
        service.confirmLabelPrinted(order.id, order.projectId, {
          sellerWallet: "0xWrongWallet",
        }),
      ).rejects.toThrow("Wallet mismatch");
    });
  });

  describe("finalize", () => {
    it("should finalize order and release remaining funds", async () => {
      const order = makeOrder({
        state: "DELIVERED",
        escrowAmountToken: "200.000000000000000000",
        escrowContractOrderId: "contract_ord_1",
        graceEndsAt: new Date(Date.now() - 1000),
      });
      (db.limit as any).mockResolvedValueOnce([order]);
      (db.returning as any).mockResolvedValueOnce([
        { ...order, state: "FINALIZED" },
      ]);

      const result = await service.finalize(order.id, order.projectId);

      expect(result.status).toBe("FINALIZED");
      expect(blockchainBridge.releaseFinal).toHaveBeenCalled();
      expect(payoutService.recordPayout).toHaveBeenCalled();
      expect(flowStateEmitter.emit).toHaveBeenCalledWith(
        "order:state_changed",
        expect.any(Object),
      );
    });

    it("should throw 409 if grace period not expired", async () => {
      const order = makeOrder({
        state: "DELIVERED",
        graceEndsAt: new Date(Date.now() + 60 * 60 * 1000),
      });
      (db.limit as any).mockResolvedValueOnce([order]);

      await expect(service.finalize(order.id, order.projectId)).rejects.toThrow(
        "Grace period has not expired",
      );
    });

    it("should throw 409 if order not in DELIVERED state", async () => {
      const order = makeOrder({ state: "SHIPPED" });
      (db.limit as any).mockResolvedValueOnce([order]);

      await expect(service.finalize(order.id, order.projectId)).rejects.toThrow(
        "Cannot finalize in state SHIPPED",
      );
    });
  });

  describe("getById", () => {
    it("should return order with items", async () => {
      const order = makeOrder();
      (db.limit as any).mockResolvedValueOnce([order]);
      // The items query: db.select().from(orderItems).where(eq(...))
      // where() is the terminal call here (no limit), so mock it to resolve
      // We need the second .where() chain to return items
      const items = [{ id: "item_1", name: "Widget" }];
      let whereCount = 0;
      (db.where as any).mockImplementation(function (this: any) {
        whereCount++;
        // First where call returns this (for the order query chain).
        // Second where call is the items query terminal - return items.
        if (whereCount === 2) {
          return Promise.resolve(items);
        }
        return this;
      });

      const result = await service.getById(order.id, order.projectId);

      expect(result.order).toEqual(order);
      expect(result.items).toEqual(items);
    });

    it("should throw 404 if order not found", async () => {
      (db.limit as any).mockResolvedValueOnce([]);

      await expect(service.getById("fs_ord_none", "proj_1")).rejects.toThrow(
        "Order not found",
      );
    });
  });
});
