import type { WebhookEnvelope } from "./types/webhooks";
export interface FlowStateServerConfig {
    apiKey?: string;
    webhookSecret?: string;
}
export declare class FlowStateServer {
    private readonly apiKey?;
    private readonly webhookSecret;
    constructor(config: FlowStateServerConfig);
    verifyAndParse<T = Record<string, unknown>>(rawBody: string, signature: string | null): WebhookEnvelope<T>;
    verifySignature(rawBody: string, signature: string | null): boolean;
}
export declare function verifyWebhookSignature(rawBody: string, signature: string | null, secret: string): boolean;
//# sourceMappingURL=server.d.ts.map