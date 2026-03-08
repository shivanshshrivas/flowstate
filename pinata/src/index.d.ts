export function initialize(jwt: string, gateway: string): void;

export function getGatewayUrl(cid: string): string;

export function pinGenericJSON(data: unknown, name: string): Promise<string>;

export function pinGenericFile(fileUrl: string, name: string): Promise<string>;

export function pinInvoice(
  pdfPath: string,
  orderData: {
    orderId: string;
    buyer: Record<string, any>;
    seller: Record<string, any>;
    items: Array<Record<string, any>>;
    shipping: Record<string, any>;
    escrow: Record<string, any>;
    platformFeeUSD: string;
  },
): Promise<{ pdfCid: string; jsonCid: string; pdfUrl: string; jsonUrl: string }>;

export function pinShippingLabel(
  labelUrl: string,
  orderId: string,
  trackingNumber: string,
): Promise<{ cid: string; url: string }>;

export function pinTrackingReceipt(params: {
  orderId: string;
  fromState: string;
  toState: string;
  escrowEvent: string;
  trackingNumber: string;
  carrier: string;
  shippoStatus: string;
  statusDetails: string;
  onChainTxHash: string;
  payoutBps: number;
}): Promise<{ cid: string; url: string; receipt: Record<string, any> }>;

export function pinPayoutReceipt(params: {
  orderId: string;
  escrowState: string;
  sellerWallet: string;
  amountToken: string;
  token: string;
  onChainTxHash: string;
  platformFeeTaken?: string;
}): Promise<{ cid: string; url: string; receipt: Record<string, any> }>;

export function pinEvidenceFile(
  fileBuffer: Buffer,
  filename: string,
  mimeType: string,
  disputeId: string,
): Promise<{ cid: string; url: string; filename: string }>;

export function pinEvidenceBundle(params: {
  disputeId: string;
  orderId: string;
  submittedBy: "buyer" | "seller";
  description: string;
  attachments: Array<{ filename: string; cid: string; url: string }>;
}): Promise<{ cid: string; url: string; bundle: Record<string, any> }>;
