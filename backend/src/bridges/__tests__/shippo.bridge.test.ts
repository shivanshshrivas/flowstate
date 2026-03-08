import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../../shippo/src", () => ({
  initialize: vi.fn(),
  getShippingRates: vi.fn(),
  purchaseLabel: vi.fn(),
  getTrackingStatus: vi.fn(),
  handleShippoWebhook: vi.fn(),
  mapToEscrowEvent: vi.fn(),
}));

vi.mock("../../config/env", () => ({
  env: { SHIPPO_KEY: "env_test_key" },
}));

import * as shippoLib from "../../../../shippo/src";
import { ShippoBridgeImpl, mapToEscrowEvent } from "../shippo.bridge";

describe("ShippoBridgeImpl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("calls initialize with the provided apiKey", () => {
      new ShippoBridgeImpl("explicit_key");
      expect(shippoLib.initialize).toHaveBeenCalledWith("explicit_key");
    });

    it("falls back to env.SHIPPO_KEY when no apiKey provided", () => {
      new ShippoBridgeImpl();
      expect(shippoLib.initialize).toHaveBeenCalledWith("env_test_key");
    });
  });

  describe("getRates", () => {
    it("delegates to shippoLib.getShippingRates and returns result", async () => {
      const mockResult = { shipmentId: "shp_1", rates: [] };
      vi.mocked(shippoLib.getShippingRates).mockResolvedValue(mockResult as any);

      const bridge = new ShippoBridgeImpl("key");
      const from = { name: "A", street1: "1 St", city: "NYC", state: "NY", zip: "10001", country: "US" };
      const to   = { name: "B", street1: "2 St", city: "LA",  state: "CA", zip: "90001", country: "US" };
      const parcel = { length: 10, width: 8, height: 4, distanceUnit: "in" as const, weight: 2, massUnit: "lb" as const };

      const result = await bridge.getRates(from, to, parcel);

      expect(shippoLib.getShippingRates).toHaveBeenCalledWith(from, to, parcel);
      expect(result).toBe(mockResult);
    });
  });

  describe("purchaseLabel", () => {
    it("delegates to shippoLib.purchaseLabel and returns result", async () => {
      const mockLabel = {
        transactionId: "txn_1",
        trackingNumber: "TRACK1",
        trackingUrlProvider: "https://track.example.com",
        carrier: "usps",
        labelUrl: "https://label.example.com/label.pdf",
        shippingCostUsd: "7.50",
      };
      vi.mocked(shippoLib.purchaseLabel).mockResolvedValue(mockLabel as any);

      const bridge = new ShippoBridgeImpl("key");
      const result = await bridge.purchaseLabel("rate_1");

      expect(shippoLib.purchaseLabel).toHaveBeenCalledWith("rate_1");
      expect(result).toBe(mockLabel);
    });
  });

  describe("getTrackingStatus", () => {
    it("delegates to shippoLib.getTrackingStatus and returns result", async () => {
      const mockTracking = {
        carrier: "usps",
        trackingNumber: "TRACK1",
        status: "TRANSIT",
        substatus: null,
        statusDetails: "In transit",
        eta: null,
        history: [],
        escrowEvent: { escrowEvent: "SHIPPED", shouldAdvance: true },
      };
      vi.mocked(shippoLib.getTrackingStatus).mockResolvedValue(mockTracking as any);

      const bridge = new ShippoBridgeImpl("key");
      const result = await bridge.getTrackingStatus("usps", "TRACK1");

      expect(shippoLib.getTrackingStatus).toHaveBeenCalledWith("usps", "TRACK1");
      expect(result).toBe(mockTracking);
    });
  });

  describe("handleWebhook", () => {
    it("delegates to shippoLib.handleShippoWebhook and returns result", async () => {
      const mockResult = { handled: true, trackingNumber: "TRACK1", carrier: "usps", status: "TRANSIT", escrowEvent: "SHIPPED", shouldAdvance: true };
      vi.mocked(shippoLib.handleShippoWebhook).mockResolvedValue(mockResult as any);

      const bridge = new ShippoBridgeImpl("key");
      const payload = { event: "track_updated" };
      const result = await bridge.handleWebhook(payload);

      expect(shippoLib.handleShippoWebhook).toHaveBeenCalledWith(payload);
      expect(result).toBe(mockResult);
    });
  });
});

describe("mapToEscrowEvent (module export)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delegates to shippoLib.mapToEscrowEvent", () => {
    const mockReturn = { escrowEvent: "DELIVERED", shouldAdvance: true };
    vi.mocked(shippoLib.mapToEscrowEvent).mockReturnValue(mockReturn as any);

    const result = mapToEscrowEvent("DELIVERED", null);

    expect(shippoLib.mapToEscrowEvent).toHaveBeenCalledWith("DELIVERED", null);
    expect(result).toBe(mockReturn);
  });
});
