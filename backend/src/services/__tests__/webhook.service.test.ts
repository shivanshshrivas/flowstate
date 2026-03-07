import { describe, it, expect, vi, beforeEach } from "vitest";
import { WebhookService } from "../webhook.service";

vi.mock("../../db/client", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue(undefined),
    returning: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("../../utils/id-generator", () => ({
  generateId: {
    webhookLog: vi.fn().mockReturnValue("fs_whl_test123"),
  },
}));

import { db } from "../../db/client";

describe("WebhookService", () => {
  let service: WebhookService;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    service = new WebhookService();
  });

  describe("dispatch", () => {
    it("should send webhooks to all matching registrations", async () => {
      const regs = [
        {
          id: "reg_1",
          url: "https://hook.example.com/1",
          secret: "secret1",
          events: ["*"],
          isActive: true,
        },
        {
          id: "reg_2",
          url: "https://hook.example.com/2",
          secret: "secret2",
          events: ["order.state_changed"],
          isActive: true,
        },
      ];
      (db.where as any).mockResolvedValueOnce(regs);

      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(new Response("ok", { status: 200 }));

      await service.dispatch("proj_1", "order.state_changed", {
        orderId: "123",
      });

      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(fetchSpy.mock.calls[0][0]).toBe("https://hook.example.com/1");
      expect(fetchSpy.mock.calls[1][0]).toBe("https://hook.example.com/2");

      // Verify headers
      const firstCallHeaders = fetchSpy.mock.calls[0][1]?.headers as Record<
        string,
        string
      >;
      expect(firstCallHeaders["X-FlowState-Event"]).toBe("order.state_changed");
      expect(firstCallHeaders["X-FlowState-Signature"]).toMatch(/^sha256=/);
    });

    it("should skip registrations that don't match event type", async () => {
      const regs = [
        {
          id: "reg_1",
          url: "https://hook.example.com/1",
          secret: "secret1",
          events: ["dispute.created"],
          isActive: true,
        },
      ];
      (db.where as any).mockResolvedValueOnce(regs);

      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(new Response("ok", { status: 200 }));

      await service.dispatch("proj_1", "order.state_changed", {
        orderId: "123",
      });

      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("should handle network errors gracefully", async () => {
      const regs = [
        {
          id: "reg_1",
          url: "https://hook.example.com/1",
          secret: "secret1",
          events: ["*"],
          isActive: true,
        },
      ];
      (db.where as any).mockResolvedValueOnce(regs);

      vi.spyOn(globalThis, "fetch").mockRejectedValue(
        new Error("Connection refused"),
      );

      // Should not throw
      await service.dispatch("proj_1", "order.state_changed", {
        orderId: "123",
      });

      expect(db.insert).toHaveBeenCalled();
    });

    it("should work with wildcard event subscriptions", async () => {
      const regs = [
        {
          id: "reg_1",
          url: "https://hook.example.com/1",
          secret: "secret1",
          events: ["*"],
          isActive: true,
        },
      ];
      (db.where as any).mockResolvedValueOnce(regs);

      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(new Response("ok", { status: 200 }));

      await service.dispatch("proj_1", "some.random.event", { data: true });

      expect(fetchSpy).toHaveBeenCalledOnce();
    });
  });
});
