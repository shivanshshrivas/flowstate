import { describe, it, expect } from "vitest";
import crypto from "crypto";
import { FlowStateServer, verifyWebhookSignature } from "../server.js";

const SECRET = "test-webhook-secret-xyz";

function hmac(body: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

describe("FlowStateServer", () => {
  it("1. constructor creates instance without throwing", () => {
    expect(() => new FlowStateServer({})).not.toThrow();
    expect(() => new FlowStateServer({ webhookSecret: SECRET, apiKey: "key" })).not.toThrow();
  });

  it("2. verifySignature returns true when no secret configured", () => {
    const srv = new FlowStateServer({});
    expect(srv.verifySignature('{"test":1}', null)).toBe(true);
    expect(srv.verifySignature('{"test":1}', "some-sig")).toBe(true);
  });

  it("3. verifySignature returns true for valid HMAC hex signature", () => {
    const srv = new FlowStateServer({ webhookSecret: SECRET });
    const body = '{"event":"order.finalized"}';
    const sig = hmac(body, SECRET);
    expect(srv.verifySignature(body, sig)).toBe(true);
  });

  it("4. verifySignature strips sha256= prefix and returns true", () => {
    const srv = new FlowStateServer({ webhookSecret: SECRET });
    const body = '{"event":"payout.released"}';
    const sig = "sha256=" + hmac(body, SECRET);
    expect(srv.verifySignature(body, sig)).toBe(true);
  });

  it("5. verifySignature returns false for wrong signature", () => {
    const srv = new FlowStateServer({ webhookSecret: SECRET });
    const body = '{"event":"test"}';
    const badSig = hmac(body, "wrong-secret");
    expect(srv.verifySignature(body, badSig)).toBe(false);
  });

  it("6. verifySignature returns false for null signature when secret set", () => {
    const srv = new FlowStateServer({ webhookSecret: SECRET });
    expect(srv.verifySignature('{"event":"test"}', null)).toBe(false);
  });

  it("7. verifySignature returns false for wrong-length signature", () => {
    const srv = new FlowStateServer({ webhookSecret: SECRET });
    expect(srv.verifySignature('{"event":"test"}', "tooshort")).toBe(false);
  });

  it("8. verifyAndParse returns parsed envelope for valid payload", () => {
    const srv = new FlowStateServer({ webhookSecret: SECRET });
    const payload = { event: "order.finalized", orderId: "ord_123", data: {} };
    const body = JSON.stringify(payload);
    const sig = hmac(body, SECRET);
    const result = srv.verifyAndParse(body, sig);
    expect(result).toMatchObject({ event: "order.finalized", orderId: "ord_123" });
  });

  it("9. verifyAndParse throws on invalid signature", () => {
    const srv = new FlowStateServer({ webhookSecret: SECRET });
    const body = '{"event":"test"}';
    expect(() => srv.verifyAndParse(body, "badsig")).toThrow("Invalid webhook signature");
  });

  it("10. verifyAndParse throws on invalid JSON body", () => {
    const srv = new FlowStateServer({ webhookSecret: SECRET });
    const body = "not-json";
    const sig = hmac(body, SECRET);
    expect(() => srv.verifyAndParse(body, sig)).toThrow("Invalid webhook payload");
  });
});

describe("verifyWebhookSignature (standalone)", () => {
  it("11. returns true for valid signature", () => {
    const body = '{"event":"escrow.created"}';
    const sig = hmac(body, SECRET);
    expect(verifyWebhookSignature(body, sig, SECRET)).toBe(true);
  });

  it("12. returns false for invalid signature", () => {
    const body = '{"event":"escrow.created"}';
    const badSig = hmac(body, "wrong");
    expect(verifyWebhookSignature(body, badSig, SECRET)).toBe(false);
  });

  it("13. returns true when no secret provided", () => {
    expect(verifyWebhookSignature('{"event":"test"}', "any-sig", "")).toBe(true);
  });

  it("14. returns false for null signature with secret", () => {
    expect(verifyWebhookSignature('{"event":"test"}', null, SECRET)).toBe(false);
  });
});
