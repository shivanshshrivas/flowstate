import { describe, it, expect, vi, beforeEach } from "vitest";
import { ShippingService } from "../shipping.service";
import {
  createMockShippoBridge,
  createMockPinataBridge,
  createMockBlockchainBridge,
} from "../../__tests__/helpers/mocks";
import { makeOrder } from "../../__tests__/helpers/fixtures";

vi.mock("../../db/client", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
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

import { db } from "../../db/client";
import { flowStateEmitter } from "../../events/emitter";

describe("ShippingService", () => {
  let service: ShippingService;
  let shippoBridge: ReturnType<typeof createMockShippoBridge>;
  let pinataBridge: ReturnType<typeof createMockPinataBridge>;
  let blockchainBridge: ReturnType<typeof createMockBlockchainBridge>;
  let payoutService: any;
  let webhookService: any;

  beforeEach(() => {
    vi.clearAllMocks();
    shippoBridge = createMockShippoBridge();
    pinataBridge = createMockPinataBridge();
    blockchainBridge = createMockBlockchainBridge();
    payoutService = { recordPayout: vi.fn().mockResolvedValue({}) };
    webhookService = { dispatch: vi.fn().mockResolvedValue(undefined) };
    service = new ShippingService(
      shippoBridge,
      pinataBridge,
      blockchainBridge,
      payoutService,
      webhookService,
    );
  });

  describe("getRates", () => {
    it("should delegate to shippo bridge", async () => {
      const from = {
        name: "A",
        street1: "1 St",
        city: "NYC",
        state: "NY",
        zip: "10001",
        country: "US",
      };
      const to = {
        name: "B",
        street1: "2 St",
        city: "LA",
        state: "CA",
        zip: "90001",
        country: "US",
      };
      const parcel = {
        length: 10,
        width: 8,
        height: 4,
        distanceUnit: "in" as const,
        weight: 2,
        massUnit: "lb" as const,
      };

      const result = await service.getRates(from, to, parcel);

      expect(result.shipmentId).toBeDefined();
      expect(shippoBridge.getRates).toHaveBeenCalledWith(from, to, parcel);
    });
  });

  describe("getTracking", () => {
    it("should return tracking info for valid order", async () => {
      const order = makeOrder({ carrier: "usps", trackingNumber: "TRACK123" });
      (db.limit as any).mockResolvedValueOnce([order]);

      const result = await service.getTracking(order.id);

      expect(result.carrier).toBe("usps");
      expect(shippoBridge.getTrackingStatus).toHaveBeenCalledWith(
        "usps",
        "TRACK123",
      );
    });

    it("should throw 404 if order not found", async () => {
      (db.limit as any).mockResolvedValueOnce([]);
      await expect(service.getTracking("fs_ord_none")).rejects.toThrow(
        "Order not found",
      );
    });

    it("should throw 400 if no tracking info", async () => {
      const order = makeOrder({ carrier: null, trackingNumber: null });
      (db.limit as any).mockResolvedValueOnce([order]);
      await expect(service.getTracking(order.id)).rejects.toThrow(
        "No tracking information",
      );
    });
  });

  describe("processWebhook", () => {
    it("should process SHIPPED event and advance state", async () => {
      (shippoBridge.handleWebhook as any).mockResolvedValueOnce({
        handled: true,
        trackingNumber: "TRACK123",
        carrier: "usps",
        status: "TRANSIT",
        escrowEvent: "SHIPPED",
        shouldAdvance: true,
      });

      const order = makeOrder({
        state: "LABEL_CREATED",
        trackingNumber: "TRACK123",
        escrowAmountToken: "200.000000000000000000",
        escrowContractOrderId: "contract_ord_1",
      });
      (db.limit as any).mockResolvedValueOnce([order]);

      const result = await service.processWebhook({ event: "track_updated" });

      expect(result.handled).toBe(true);
      expect(pinataBridge.pinJSON).toHaveBeenCalled();
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

    it("should process DELIVERED event and set grace period", async () => {
      (shippoBridge.handleWebhook as any).mockResolvedValueOnce({
        handled: true,
        trackingNumber: "TRACK123",
        carrier: "usps",
        status: "DELIVERED",
        escrowEvent: "DELIVERED",
        shouldAdvance: true,
      });

      const order = makeOrder({
        state: "SHIPPED",
        trackingNumber: "TRACK123",
        escrowAmountToken: "200.000000000000000000",
        escrowContractOrderId: "contract_ord_1",
      });
      (db.limit as any).mockResolvedValueOnce([order]);

      const result = await service.processWebhook({ event: "track_updated" });

      expect(result.handled).toBe(true);
      expect(blockchainBridge.releasePartial).toHaveBeenCalledWith(
        "contract_ord_1",
        3500,
      );
    });

    it("should return unhandled for non-track events", async () => {
      (shippoBridge.handleWebhook as any).mockResolvedValueOnce({
        handled: false,
        reason: "Ignored event type: other",
      });

      const result = await service.processWebhook({ event: "other" });

      expect(result.handled).toBe(false);
    });

    it("should return unhandled if order not found", async () => {
      (shippoBridge.handleWebhook as any).mockResolvedValueOnce({
        handled: true,
        trackingNumber: "TRACK_UNKNOWN",
        escrowEvent: "SHIPPED",
        shouldAdvance: true,
      });
      (db.limit as any).mockResolvedValueOnce([]);

      const result = await service.processWebhook({ event: "track_updated" });

      expect(result.handled).toBe(false);
      expect(result.reason).toContain("Order not found");
    });
  });
});
