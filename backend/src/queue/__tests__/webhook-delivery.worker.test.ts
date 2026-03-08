import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../db/client", () => {
  const mockDb = Object.assign(vi.fn().mockResolvedValue([]), {
    json: (v: any) => v,
  });
  return { db: mockDb };
});

vi.mock("../../utils/id-generator", () => ({
  generateId: {
    webhookLog: vi.fn().mockReturnValue("fs_whl_test123"),
  },
}));

import { WEBHOOK_DELIVERY_JOB_OPTS } from "../workers/webhook-delivery.worker";

describe("Webhook Delivery Worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe("job configuration", () => {
    it("should use exponential backoff with 5 attempts", () => {
      expect(WEBHOOK_DELIVERY_JOB_OPTS.attempts).toBe(5);
      expect(WEBHOOK_DELIVERY_JOB_OPTS.backoff.type).toBe("exponential");
      expect(WEBHOOK_DELIVERY_JOB_OPTS.backoff.delay).toBe(5000);
    });

    it("should have retention limits", () => {
      expect(WEBHOOK_DELIVERY_JOB_OPTS.removeOnComplete).toEqual({
        count: 1000,
      });
      expect(WEBHOOK_DELIVERY_JOB_OPTS.removeOnFail).toEqual({ count: 5000 });
    });
  });
});
