import crypto from "crypto";

export interface FlowStateServerConfig {
  apiKey?: string;
  webhookSecret?: string;
}

function getSignatureValue(signature: string | null | undefined): string {
  if (!signature) return "";
  if (signature.startsWith("sha256=")) {
    return signature.slice(7);
  }
  return signature;
}

export class FlowStateServer {
  private readonly apiKey?: string;
  private readonly webhookSecret: string;

  constructor(config: FlowStateServerConfig) {
    this.apiKey = config?.apiKey;
    this.webhookSecret = config?.webhookSecret ?? "";
  }

  verifyAndParse(rawBody: string, signature: string | null): Record<string, unknown> {
    if (!this.verifySignature(rawBody, signature)) {
      throw new Error("Invalid webhook signature");
    }

    try {
      return JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      throw new Error("Invalid webhook payload");
    }
  }

  verifySignature(rawBody: string, signature: string | null): boolean {
    if (!this.webhookSecret) {
      return true;
    }

    if (!signature) {
      return false;
    }

    const expected = crypto
      .createHmac("sha256", this.webhookSecret)
      .update(rawBody)
      .digest("hex");

    const received = getSignatureValue(signature);
    if (received.length !== expected.length) {
      return false;
    }

    return crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected));
  }
}

export function verifyWebhookSignature(
  rawBody: string,
  signature: string | null,
  secret: string
): boolean {
  if (!secret) return true;
  if (!signature) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  const received = getSignatureValue(signature);

  if (received.length !== expected.length) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected));
}