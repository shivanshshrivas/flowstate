import crypto from "crypto";

function getSignatureValue(signature) {
  if (!signature) return "";
  if (signature.startsWith("sha256=")) {
    return signature.slice(7);
  }
  return signature;
}

export class FlowStateServer {
  constructor(config) {
    this.apiKey = config?.apiKey;
    this.webhookSecret = config?.webhookSecret || "";
  }

  verifyAndParse(rawBody, signature) {
    if (!this.verifySignature(rawBody, signature)) {
      throw new Error("Invalid webhook signature");
    }

    try {
      return JSON.parse(rawBody);
    } catch {
      throw new Error("Invalid webhook payload");
    }
  }

  verifySignature(rawBody, signature) {
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

export function verifyWebhookSignature(rawBody, signature, secret) {
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