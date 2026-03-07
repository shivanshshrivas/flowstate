import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { buildTestApp } from "../../__tests__/helpers/app";
import type { FastifyInstance } from "fastify";

// Mock the auth middleware to let requests through with a test projectId
vi.mock("../../middleware/auth", () => ({
  authPreHandler: vi.fn().mockImplementation(async (request: any) => {
    request.projectId = "fs_proj_test";
  }),
}));

describe("Orders Routes", () => {
  let app: FastifyInstance;
  let orderService: any;

  beforeEach(async () => {
    orderService = {
      create: vi.fn(),
      selectShipping: vi.fn(),
      confirmEscrow: vi.fn(),
      confirmLabelPrinted: vi.fn(),
      finalize: vi.fn(),
      getById: vi.fn(),
    };
    app = await buildTestApp({ orderService });
  });

  afterEach(async () => {
    await app.close();
  });

  describe("POST /api/v1/orders/create", () => {
    const validBody = {
      seller_id: "fs_sel_123",
      buyer_wallet: "0xBuyer",
      seller_wallet: "0xSeller",
      address_from: {
        name: "A",
        street1: "1 St",
        city: "NYC",
        state: "NY",
        zip: "10001",
        country: "US",
      },
      address_to: {
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
        distanceUnit: "in",
        weight: 2,
        massUnit: "lb",
      },
      items: [{ name: "Widget", quantity: 1, unitPriceUsd: 50 }],
    };

    it("should return 201 on valid request", async () => {
      orderService.create.mockResolvedValue({
        orderId: "fs_ord_123",
        shippingOptions: [],
        escrowAddress: "0xEscrow",
        subtotalUsd: 50,
        totalUsd: 50,
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/orders/create",
        headers: { authorization: "Bearer fs_live_key_test12345678901" },
        payload: validBody,
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.order_id).toBe("fs_ord_123");
    });

    it("should return 400 on invalid body (missing seller_id)", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/orders/create",
        headers: { authorization: "Bearer fs_live_key_test12345678901" },
        payload: { ...validBody, seller_id: "" },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
    });

    it("should return 400 on missing items", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/orders/create",
        headers: { authorization: "Bearer fs_live_key_test12345678901" },
        payload: { ...validBody, items: [] },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe("POST /api/v1/orders/:id/select-shipping", () => {
    it("should return success on valid request", async () => {
      orderService.selectShipping.mockResolvedValue({
        escrowAmountToken: "200.00",
        exchangeRate: 0.5,
        labelCid: "QmLabel",
        totalUsd: 107.5,
        shippingCostUsd: 7.5,
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/orders/fs_ord_123/select-shipping",
        headers: { authorization: "Bearer fs_live_key_test12345678901" },
        payload: { rate_id: "rate_1" },
      });

      expect(res.statusCode).toBe(200);
    });

    it("should return 400 on missing rate_id", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/orders/fs_ord_123/select-shipping",
        headers: { authorization: "Bearer fs_live_key_test12345678901" },
        payload: {},
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe("POST /api/v1/orders/:id/confirm-escrow", () => {
    it("should return success on valid tx_hash", async () => {
      orderService.confirmEscrow.mockResolvedValue({
        status: "ESCROWED",
        invoiceCid: "QmInvoice",
        payoutSchedule: {
          labelCreatedBps: 1500,
          shippedBps: 1500,
          deliveredBps: 3500,
          finalizedBps: 3500,
        },
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/orders/fs_ord_123/confirm-escrow",
        headers: { authorization: "Bearer fs_live_key_test12345678901" },
        payload: { tx_hash: "0xabc123" },
      });

      expect(res.statusCode).toBe(200);
    });
  });

  describe("GET /api/v1/orders/:id", () => {
    it("should return order and items", async () => {
      orderService.getById.mockResolvedValue({
        order: { id: "fs_ord_123", state: "INITIATED" },
        items: [{ id: "item_1", name: "Widget" }],
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/v1/orders/fs_ord_123",
        headers: { authorization: "Bearer fs_live_key_test12345678901" },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.order.id).toBe("fs_ord_123");
    });
  });
});
