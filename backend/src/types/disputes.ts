import type { DisputeStatus } from "../config/constants";

export interface CreateDisputeInput {
  orderId: string;
  reason: string;
  evidenceUrls: string[];
}

export interface RespondDisputeInput {
  action: "accept" | "contest";
  evidenceUrls?: string[];
}

export interface ResolveDisputeInput {
  resolution: "refund" | "release" | "split";
  splitBps?: number;
}

export interface DisputeSummary {
  id: string;
  orderId: string;
  status: DisputeStatus;
  reason: string;
  frozenAmountToken: string | null;
  sellerDeadline: Date | null;
  reviewDeadline: Date | null;
  resolvedAt: Date | null;
  createdAt: Date;
}
