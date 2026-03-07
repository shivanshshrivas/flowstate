import { db } from "../db/client";
import type { Order, Dispute } from "../db/types";
import { toDate } from "../db/utils";
import { generateId } from "../utils/id-generator";
import {
  SELLER_DISPUTE_DEADLINE_HOURS,
  REVIEW_DEADLINE_DAYS,
} from "../config/constants";
import { flowStateEmitter } from "../events/emitter";
import type { IPinataBridge } from "../bridges/pinata.bridge";
import type { IBlockchainBridge } from "../bridges/blockchain.bridge";
import type {
  CreateDisputeInput,
  RespondDisputeInput,
  ResolveDisputeInput,
} from "../types/disputes";

export class DisputeService {
  constructor(
    private pinataBridge: IPinataBridge,
    private blockchainBridge: IBlockchainBridge,
  ) {}

  async create(
    projectId: string,
    input: CreateDisputeInput,
  ): Promise<{
    disputeId: string;
    frozenAmountToken: string;
    sellerDeadline: Date;
  }> {
    const orderRows = await db<Order[]>`
      select *
      from orders
      where id = ${input.orderId}
        and project_id = ${projectId}
      limit 1
    `;

    const order = orderRows[0];

    if (!order) {
      const err: any = new Error("Order not found");
      err.statusCode = 404;
      throw err;
    }

    if (order.state !== "DELIVERED") {
      const err: any = new Error(
        `Disputes can only be opened on DELIVERED orders. Current state: ${order.state}`,
      );
      err.statusCode = 409;
      throw err;
    }

    const graceEndsAt = toDate(order.graceEndsAt);
    if (graceEndsAt && graceEndsAt < new Date()) {
      const err: any = new Error("Grace period has expired; dispute window is closed");
      err.statusCode = 409;
      throw err;
    }

    let buyerEvidenceCid: string | undefined;
    if (input.evidenceUrls.length > 0) {
      buyerEvidenceCid = await this.pinataBridge.pinFile(
        input.evidenceUrls[0],
        `evidence_buyer_${input.orderId}`,
      );
    }

    const frozenAmountToken = order.escrowAmountToken ?? "0";
    const contractOrderId = order.escrowContractOrderId!;

    const { disputeId: contractDisputeId } = await this.blockchainBridge.initiateDispute(
      contractOrderId,
      buyerEvidenceCid ?? "",
    );

    const now = new Date();
    const sellerDeadline = new Date(
      now.getTime() + SELLER_DISPUTE_DEADLINE_HOURS * 60 * 60 * 1000,
    );

    const disputeRows = await db<Dispute[]>`
      insert into disputes (
        id,
        order_id,
        buyer_wallet,
        seller_wallet,
        status,
        reason,
        buyer_evidence_cid,
        frozen_amount_token,
        contract_dispute_id,
        seller_deadline
      ) values (
        ${generateId.dispute()},
        ${input.orderId},
        ${order.buyerWallet},
        ${order.sellerWallet},
        ${"OPEN"},
        ${input.reason},
        ${buyerEvidenceCid ?? null},
        ${frozenAmountToken},
        ${contractDisputeId},
        ${sellerDeadline}
      )
      returning *
    `;

    const dispute = disputeRows[0];

    await db`
      update orders
      set state = ${"DISPUTED"}, updated_at = now()
      where id = ${input.orderId}
    `;

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
    input: RespondDisputeInput,
  ): Promise<{ status: string; txHash: string; reviewDeadline?: Date }> {
    const disputeRows = await db<Dispute[]>`
      select *
      from disputes
      where id = ${disputeId}
      limit 1
    `;

    const dispute = disputeRows[0];

    if (!dispute) {
      const err: any = new Error("Dispute not found");
      err.statusCode = 404;
      throw err;
    }

    const orderRows = await db<Order[]>`
      select *
      from orders
      where id = ${dispute.orderId}
        and project_id = ${projectId}
      limit 1
    `;

    const order = orderRows[0];

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
      const { txHash } = await this.blockchainBridge.resolveDispute(
        dispute.contractDisputeId!,
        "refund",
      );
      await this.blockchainBridge.refundBuyer(order.escrowContractOrderId!);

      await db`
        update disputes
        set
          status = ${"RESOLVED_BUYER"},
          resolution_type = ${"refund"},
          resolution_tx_hash = ${txHash},
          resolved_at = now(),
          updated_at = now()
        where id = ${disputeId}
      `;

      return { status: "RESOLVED_BUYER", txHash };
    }

    let sellerEvidenceCid: string | undefined;
    if (input.evidenceUrls && input.evidenceUrls.length > 0) {
      sellerEvidenceCid = await this.pinataBridge.pinFile(
        input.evidenceUrls[0],
        `evidence_seller_${disputeId}`,
      );
    }

    const { txHash } = await this.blockchainBridge.respondToDispute(
      dispute.contractDisputeId!,
      false,
      sellerEvidenceCid,
    );

    const reviewDeadline = new Date(
      Date.now() + REVIEW_DEADLINE_DAYS * 24 * 60 * 60 * 1000,
    );

    await db`
      update disputes
      set
        status = ${"SELLER_RESPONDED"},
        seller_evidence_cid = ${sellerEvidenceCid ?? null},
        review_deadline = ${reviewDeadline},
        updated_at = now()
      where id = ${disputeId}
    `;

    return { status: "SELLER_RESPONDED", txHash, reviewDeadline };
  }

  async resolve(
    disputeId: string,
    projectId: string,
    input: ResolveDisputeInput,
  ): Promise<{ status: string; txHash: string }> {
    const disputeRows = await db<Dispute[]>`
      select *
      from disputes
      where id = ${disputeId}
      limit 1
    `;

    const dispute = disputeRows[0];

    if (!dispute) {
      const err: any = new Error("Dispute not found");
      err.statusCode = 404;
      throw err;
    }

    const orderRows = await db<Order[]>`
      select *
      from orders
      where id = ${dispute.orderId}
        and project_id = ${projectId}
      limit 1
    `;

    const order = orderRows[0];

    if (!order) {
      const err: any = new Error("Dispute not accessible for this project");
      err.statusCode = 403;
      throw err;
    }

    const { txHash } = await this.blockchainBridge.resolveDispute(
      dispute.contractDisputeId!,
      input.resolution,
      input.splitBps,
    );

    const statusMap = {
      refund: "RESOLVED_BUYER",
      release: "RESOLVED_SELLER",
      split: "RESOLVED_SPLIT",
    } as const;

    const newStatus = statusMap[input.resolution];

    await db`
      update disputes
      set
        status = ${newStatus},
        resolution_type = ${input.resolution},
        resolution_split_bps = ${input.splitBps ?? null},
        resolution_tx_hash = ${txHash},
        resolved_at = now(),
        updated_at = now()
      where id = ${disputeId}
    `;

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