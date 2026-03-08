/**
 * WebhookService tests
 *
 * db is a tagged-template function (postgres library), not Drizzle.
 * We mock it as a callable that is also an object with a .json() method.
 *
 * vi.hoisted() is required because vi.mock factories are hoisted to the top
 * of the file and cannot reference variables defined after them.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { signWebhook } from "../../utils/crypto";

// ─── Hoisted mock variables ───────────────────────────────────────────────────

const { mockDb, mockQueueAdd, mockQueuesAvailable, mockGetWebhookDeliveryQueue } = vi.hoisted(() => {
  const mockQueueAdd = vi.fn().mockResolvedValue(undefined);
  const mockQueuesAvailable = vi.fn(() => false);
  const mockGetWebhookDeliveryQueue = vi.fn(() => ({ add: mockQueueAdd }));
  const mockDb = Object.assign(
    vi.fn().mockResolvedValue([]),
    { json: vi.fn((v: unknown) => v) }
  );
  return { mockDb, mockQueueAdd, mockQueuesAvailable, mockGetWebhookDeliveryQueue };
});

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("../../db/client", () => ({ db: mockDb }));

vi.mock("../../queue/queues", () => ({
  queuesAvailable: mockQueuesAvailable,
  getWebhookDeliveryQueue: mockGetWebhookDeliveryQueue,
}));

vi.mock("../../queue/workers/webhook-delivery.worker", () => ({
  WEBHOOK_DELIVERY_JOB_OPTS: {},
}));

vi.mock("../../utils/id-generator", () => ({
  generateId: { webhookLog: () => "log_test_id" },
}));

// ─── Import after mocks ───────────────────────────────────────────────────────

import { WebhookService } from "../webhook.service";

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const mockReg = {
  id: "reg_001",
  url: "https://example.com/webhooks",
  secret: "whsec_" + "a".repeat(64),
  events: ["*"],
  projectId: "proj_abc",
  isActive: true,
};

// ─── deliverToRegistration ────────────────────────────────────────────────────

describe("WebhookService.deliverToRegistration", () => {
  let service: WebhookService;

  beforeEach(() => {
    service = new WebhookService();
    mockDb.mockClear();
    mockDb.mockResolvedValue([]);
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      text: async () => "OK",
    });
  });

  it("POSTs to registration URL with X-FlowState-Event header", async () => {
    const body = JSON.stringify({ event: "order.state_changed", data: {} });
    await service.deliverToRegistration(mockReg, "proj_abc", "order.state_changed", {}, body);

    expect(global.fetch).toHaveBeenCalledWith(
      mockReg.url,
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "X-FlowState-Event": "order.state_changed",
        }),
      })
    );
  });

  it("signature in X-FlowState-Signature matches signWebhook(body, secret)", async () => {
    const body = '{"event":"test","data":{}}';
    await service.deliverToRegistration(mockReg, "proj_abc", "test", {}, body);

    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const sentSig: string = call[1].headers["X-FlowState-Signature"];
    expect(sentSig).toBe(`sha256=${signWebhook(body, mockReg.secret)}`);
  });

  it("returns statusCode and responseBody on success", async () => {
    const result = await service.deliverToRegistration(mockReg, "proj_abc", "test", {}, "{}");
    expect(result).toEqual({ statusCode: 200, responseBody: "OK" });
  });

  it("returns statusCode 0 and error message on network failure", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    const result = await service.deliverToRegistration(mockReg, "proj_abc", "test", {}, "{}");
    expect(result.statusCode).toBe(0);
    expect(result.responseBody).toBe("ECONNREFUSED");
  });
});

// ─── dispatch ─────────────────────────────────────────────────────────────────

describe("WebhookService.dispatch", () => {
  let service: WebhookService;

  beforeEach(() => {
    service = new WebhookService();
    mockDb.mockClear();
    global.fetch = vi.fn().mockResolvedValue({ status: 200, text: async () => "OK" });
  });

  it("calls fetch for wildcard-subscribed registrations", async () => {
    mockDb.mockResolvedValueOnce([mockReg]);
    await service.dispatch("proj_abc", "order.state_changed", { order_id: "ord_1" });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("skips registrations that don't subscribe to the event", async () => {
    const restrictedReg = { ...mockReg, events: ["dispute.created"] };
    mockDb.mockResolvedValueOnce([restrictedReg]);
    await service.dispatch("proj_abc", "order.state_changed", {});
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("delivers to specific-event-matched registrations", async () => {
    const specificReg = { ...mockReg, events: ["order.state_changed"] };
    mockDb.mockResolvedValueOnce([specificReg]);
    await service.dispatch("proj_abc", "order.state_changed", {});
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("does not throw on network error", async () => {
    mockDb.mockResolvedValueOnce([mockReg]);
    global.fetch = vi.fn().mockRejectedValue(new Error("Connection refused"));
    await expect(service.dispatch("proj_abc", "order.state_changed", {})).resolves.not.toThrow();
  });
});

// ─── enqueueDispatch ──────────────────────────────────────────────────────────

describe("WebhookService.enqueueDispatch", () => {
  let service: WebhookService;

  beforeEach(() => {
    service = new WebhookService();
    mockDb.mockClear();
    mockQueueAdd.mockClear();
    global.fetch = vi.fn().mockResolvedValue({ status: 200, text: async () => "OK" });
  });

  it("falls back to dispatch() (calls fetch) when queues unavailable", async () => {
    mockQueuesAvailable.mockReturnValue(false);
    mockDb.mockResolvedValueOnce([mockReg]);
    await service.enqueueDispatch("proj_abc", "payout.released", {});
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(mockQueueAdd).not.toHaveBeenCalled();
  });

  it("adds BullMQ jobs and does not call fetch when queues are available", async () => {
    mockQueuesAvailable.mockReturnValue(true);
    mockGetWebhookDeliveryQueue.mockReturnValue({ add: mockQueueAdd });
    mockDb.mockResolvedValueOnce([mockReg]);
    await service.enqueueDispatch("proj_abc", "payout.released", { payout_id: "pay_1" });
    expect(mockQueueAdd).toHaveBeenCalledTimes(1);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("BullMQ job payload includes url, secret, eventType, and body", async () => {
    mockQueuesAvailable.mockReturnValue(true);
    mockGetWebhookDeliveryQueue.mockReturnValue({ add: mockQueueAdd });
    mockDb.mockResolvedValueOnce([mockReg]);
    await service.enqueueDispatch("proj_abc", "payout.released", { payout_id: "pay_1" });

    const jobData = mockQueueAdd.mock.calls[0][1];
    expect(jobData).toMatchObject({
      url: mockReg.url,
      secret: mockReg.secret,
      eventType: "payout.released",
      projectId: "proj_abc",
    });
    expect(typeof jobData.body).toBe("string");
  });
});
