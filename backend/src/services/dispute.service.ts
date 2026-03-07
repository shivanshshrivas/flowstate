import { db } from "../db/client";
import { orders, disputes } from "../db/schema";
import { generateId } from "../utils/id-generator";
import { eq, and } from "drizzle-orm";
import { SELLER_DISPUTE_DEADLINE_HOURS, REVIEW_DEADLINE_DAYS } from "../config/constants";
import { flowStateEmitter } from "../events/emitter";
import type { IPinataBridge } from "../bridges/pinata.bridge";
import type { IBlockchainBridge } from "../bridges/blockchain.bridge";
import type { CreateDisputeInput, RespondDisputeInput, ResolveDisputeInput } from "../types/disputes";
import type { Dispute } from "../db/schema";

export class DisputeService {
  constructor(
    private pinataBridge: IPinataBridge,
    private blockchainBridge: IBlockchainBridge
  ) {}

  async create(
    projectId: string,
    input: CreateDisputeInput
  ): Promise<{
    disputeId: string;
    frozenAmountToken: string;
    sellerDeadline: Date;
  }> {
    const [order] = await db
      .select()
      .from(orders)
      .where(and(eq(orders.id, input.orderId), eq(orders.projectId, projectId)))
      .limit(1);

    if (!order) {
      const err: any = new Error("Order not found");
      err.statusCode = 404;
      throw err;
    }

    if (order.state !== "DELIVERED") {
      const err: any = new Error(
        `Disputes can only be opened on DELIVERED orders. Current state: ${order.state}`
      );
      err.statusCode = 409;
      throw err;
    }

    // Must be within grace period
    if (order.graceEndsAt && order.graceEndsAt < new Date()) {
      const err: any = new Error("Grace period has expired; dispute window is closed");
      err.statusCode = 409;
      throw err;
    }

    // Pin evidence to IPFS
    let buyerEvidenceCid: string | undefined;
    if (input.evidenceUrls.length > 0) {
      buyerEvidenceCid = await this.pinataBridge.pinFile(
        input.evidenceUrls[0],
        `evidence_buyer_${input.orderId}`
      );
    }

    const frozenAmountToken = order.escrowAmountToken ?? "0";
    const contractOrderId = order.escrowContractOrderId!;

    // Initiate dispute on-chain
    const { txHash, disputeId: contractDisputeId } = await this.blockchainBridge.initiateDispute(
      contractOrderId,
      buyerEvidenceCid ?? ""
    );

    const now = new Date();
    const sellerDeadline = new Date(
      now.getTime() + SELLER_DISPUTE_DEADLINE_HOURS * 60 * 60 * 1000
    );

    const [dispute] = await db
      .insert(disputes)
      .values({
        id: generateId.dispute(),
        orderId: input.orderId,
        buyerWallet: order.buyerWallet,
        sellerWallet: order.sellerWallet,
        status: "OPEN",
        reason: input.reason,
        buyerEvidenceCid,
        frozenAmountToken,
        contractDisputeId,
        sellerDeadline,
      })
      .returning();

    // Update order to DISPUTED
    await db
      .update(orders)
      .set({ state: "DISPUTED", updatedAt: now })
      .where(eq(orders.id, input.orderId));

    flowStateEmitter.emit("dispute:created", {
      disputeId: dispute.id,
      orderId: input.orderId,
      projectId,
      buyerWallet: order.buyerWallet,
      sellerDeadline,
    });

    return {
      disputeId: dispute.id,
      frozenAmountToken,
      sellerDeadline,
    };
  }

  async respond(
    disputeId: string,
    projectId: string,
    input: RespondDisputeInput
  ): Promise<{ status: string; txHash: string; reviewDeadline?: Date }> {
    const [dispute] = await db
      .select()
      .from(disputes)
      .where(eq(disputes.id, disputeId))
      .limit(1);

    if (!dispute) {
      const err: any = new Error("Dispute not found");
      err.statusCode = 404;
      throw err;
    }

    // Verify dispute belongs to this project via order
    const [order] = await db
      .select()
      .from(orders)
      .where(and(eq(orders.id, dispute.orderId), eq(orders.projectId, projectId)))
      .limit(1);

    if (!order) {
      const err: any = new Error("Dispute not accessible for this project");
      err.statusCode = 403;
      throw err;
    }

    if (dispute.status !== "OPEN") {
      const err: any = new Error(`Cannot respond to dispute in status ${dispute.status}`);
      err.statusCode = 409;
      throw err;
    }

    if (input.action === "accept") {
      // Seller accepts → refund buyer
      const { txHash } = await this.blockchainBridge.resolveDispute(
        dispute.contractDisputeId!,
        "refund"
      );
      await this.blockchainBridge.refundBuyer(order.escrowContractOrderId!);

      await db
        .update(disputes)
        .set({
          status: "RESOLVED_BUYER",
          resolutionType: "refund",
          resolutionTxHash: txHash,
          resolvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(disputes.id, disputeId));

      return { status: "RESOLVED_BUYER", txHash };
    }

    // Seller contests
    let sellerEvidenceCid: string | undefined;
    if (input.evidenceUrls && input.evidenceUrls.length > 0) {
      sellerEvidenceCid = await this.pinataBridge.pinFile(
        input.evidenceUrls[0],
        `evidence_seller_${disputeId}`
      );
    }

    const { txHash } = await this.blockchainBridge.respondToDispute(
      dispute.contractDisputeId!,
      false,
      sellerEvidenceCid
    );

    const reviewDeadline = new Date(
      Date.now() + REVIEW_DEADLINE_DAYS * 24 * 60 * 60 * 1000
    );

    await db
      .update(disputes)
      .set({
        status: "SELLER_RESPONDED",
        sellerEvidenceCid,
        reviewDeadline,
        updatedAt: new Date(),
      })
      .where(eq(disputes.id, disputeId));

    return { status: "SELLER_RESPONDED", txHash, reviewDeadline };
  }

  async resolve(
    disputeId: string,
    projectId: string,
    input: ResolveDisputeInput
  ): Promise<{ status: string; txHash: string }> {
    const [dispute] = await db
      .select()
      .from(disputes)
      .where(eq(disputes.id, disputeId))
      .limit(1);

    if (!dispute) {
      const err: any = new Error("Dispute not found");
      err.statusCode = 404;
      throw err;
    }

    const [order] = await db
      .select()
      .from(orders)
      .where(and(eq(orders.id, dispute.orderId), eq(orders.projectId, projectId)))
      .limit(1);

    if (!order) {
      const err: any = new Error("Dispute not accessible for this project");
      err.statusCode = 403;
      throw err;
    }

    const { txHash } = await this.blockchainBridge.resolveDispute(
      dispute.contractDisputeId!,
      input.resolution,
      input.splitBps
    );

    const statusMap = {
      refund: "RESOLVED_BUYER",
      release: "RESOLVED_SELLER",
      split: "RESOLVED_SPLIT",
    } as const;

    const newStatus = statusMap[input.resolution];

    await db
      .update(disputes)
      .set({
        status: newStatus,
        resolutionType: input.resolution,
        resolutionSplitBps: input.splitBps,
        resolutionTxHash: txHash,
        resolvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(disputes.id, disputeId));

    flowStateEmitter.emit("dispute:resolved", {
      disputeId,
      orderId: dispute.orderId,
      projectId,
      resolution: input.resolution,
      txHash,
    });

    return { status: newStatus, txHash };
  }
}
