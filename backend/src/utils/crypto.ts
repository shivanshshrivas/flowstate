import { createHash, createHmac, timingSafeEqual } from "crypto";

/**
 * Hash an API key with SHA-256 for storage.
 */
export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/**
 * Sign a webhook payload with HMAC-SHA256.
 */
export function signWebhook(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Verify a webhook signature in constant time (prevents timing attacks).
 */
export function verifyWebhookSignature(
  payload: string,
  secret: string,
  signature: string
): boolean {
  const expected = signWebhook(payload, secret);
  const expectedBuf = Buffer.from(expected, "hex");
  const signatureBuf = Buffer.from(signature, "hex");
  if (expectedBuf.length !== signatureBuf.length) return false;
  return timingSafeEqual(expectedBuf, signatureBuf);
}

/**
 * Generate a random webhook secret (hex string).
 */
export function generateWebhookSecret(): string {
  return createHash("sha256").update(Math.random().toString()).digest("hex");
}
