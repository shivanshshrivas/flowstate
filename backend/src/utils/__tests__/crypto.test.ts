import { createHmac, createHash } from "crypto";
import { describe, it, expect } from "vitest";
import {
  signWebhook,
  verifyWebhookSignature,
  generateWebhookSecret,
  hashApiKey,
} from "../crypto";

describe("signWebhook", () => {
  it("returns HMAC-SHA256 hex of the payload", () => {
    const payload = '{"event":"order.state_changed"}';
    const secret = "test-secret";
    const expected = createHmac("sha256", secret).update(payload).digest("hex");
    expect(signWebhook(payload, secret)).toBe(expected);
  });

  it("produces different results for different secrets", () => {
    const payload = "test";
    expect(signWebhook(payload, "secret-a")).not.toBe(signWebhook(payload, "secret-b"));
  });
});

describe("verifyWebhookSignature", () => {
  const payload = '{"event":"payout.released"}';
  const secret = "whsec_abc123";

  it("returns true for a valid signature", () => {
    const sig = signWebhook(payload, secret);
    expect(verifyWebhookSignature(payload, secret, sig)).toBe(true);
  });

  it("returns false for an invalid signature", () => {
    expect(verifyWebhookSignature(payload, secret, "deadbeef".repeat(8))).toBe(false);
  });

  it("returns false when signature has wrong length", () => {
    expect(verifyWebhookSignature(payload, secret, "abc")).toBe(false);
  });
});

describe("generateWebhookSecret", () => {
  it("starts with 'whsec_'", () => {
    expect(generateWebhookSecret()).toMatch(/^whsec_/);
  });

  it("is 70 characters long (6 prefix + 64 hex)", () => {
    expect(generateWebhookSecret()).toHaveLength(70);
  });

  it("produces unique values on each call", () => {
    expect(generateWebhookSecret()).not.toBe(generateWebhookSecret());
  });
});

describe("hashApiKey", () => {
  it("returns deterministic SHA-256 hex", () => {
    const key = "sf_live_key_xyz";
    const expected = createHash("sha256").update(key).digest("hex");
    expect(hashApiKey(key)).toBe(expected);
  });

  it("produces different hashes for different keys", () => {
    expect(hashApiKey("key-a")).not.toBe(hashApiKey("key-b"));
  });
});
