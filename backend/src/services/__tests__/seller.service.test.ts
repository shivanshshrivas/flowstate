import { describe, it, expect, vi, beforeEach } from "vitest";
import { SellerService } from "../seller.service";
import {
  makeSeller,
  makeOrder,
  makePayout,
} from "../../__tests__/helpers/fixtures";

vi.mock("../../db/client", () => {
  const mockDb = Object.assign(vi.fn().mockResolvedValue([]), {
    json: (v: any) => v,
  });
  return { db: mockDb };
});

import { db } from "../../db/client";

describe("SellerService", () => {
  let service: SellerService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SellerService();
  });

  describe("onboard", () => {
    it("should onboard a seller with default payout config", async () => {
      const seller = makeSeller();
      (db as any).mockResolvedValueOnce([seller]);

      const result = await service.onboard("proj_1", {
        walletAddress: "0xSeller",
        businessName: "Test Shop",
        businessAddress: {
          street1: "1 St",
          city: "NYC",
          state: "NY",
          zip: "10001",
          country: "US",
        },
      });

      expect(result.id).toBeDefined();
      expect(db).toHaveBeenCalled();
    });

    it("should throw 400 if payout config does not sum to 10000 bps", async () => {
      await expect(
        service.onboard("proj_1", {
          walletAddress: "0xSeller",
          businessName: "Test Shop",
          businessAddress: {
            street1: "1 St",
            city: "NYC",
            state: "NY",
            zip: "10001",
            country: "US",
          },
          payoutConfig: {
            labelCreatedBps: 1000,
            shippedBps: 1000,
            inTransitBps: 1000,
            deliveredBps: 1000,
            finalizedBps: 1000,
          },
        }),
      ).rejects.toThrow("Payout config must sum to 10000 bps");
    });

    it("should accept valid custom payout config", async () => {
      const seller = makeSeller();
      (db as any).mockResolvedValueOnce([seller]);

      const result = await service.onboard("proj_1", {
        walletAddress: "0xSeller",
        businessName: "Test Shop",
        businessAddress: {
          street1: "1 St",
          city: "NYC",
          state: "NY",
          zip: "10001",
          country: "US",
        },
        payoutConfig: {
          labelCreatedBps: 2000,
          shippedBps: 1500,
          inTransitBps: 1500,
          deliveredBps: 3000,
          finalizedBps: 2000,
        },
      });

      expect(result.id).toBeDefined();
    });
  });

  describe("getOrders", () => {
    it("should throw 404 if seller not found", async () => {
      (db as any).mockResolvedValueOnce([]);

      await expect(service.getOrders("fs_sel_none", "proj_1")).rejects.toThrow(
        "Seller not found",
      );
    });
  });

  describe("getMetrics", () => {
    it("should throw 404 if seller not found", async () => {
      (db as any).mockResolvedValueOnce([]);

      await expect(service.getMetrics("fs_sel_none", "proj_1")).rejects.toThrow(
        "Seller not found",
      );
    });
  });

  describe("getPayouts", () => {
    it("should throw 404 if seller not found", async () => {
      (db as any).mockResolvedValueOnce([]);

      await expect(service.getPayouts("fs_sel_none", "proj_1")).rejects.toThrow(
        "Seller not found",
      );
    });
  });
});
