export interface FlowStateServerConfig {
  apiKey?: string;
  webhookSecret?: string;
}

export declare class FlowStateServer {
  constructor(config: FlowStateServerConfig);
  verifyAndParse(rawBody: string, signature: string | null): Record<string, unknown>;
  verifySignature(rawBody: string, signature: string | null): boolean;
}

export declare function verifyWebhookSignature(
  rawBody: string,
  signature: string | null,
  secret: string
): boolean;