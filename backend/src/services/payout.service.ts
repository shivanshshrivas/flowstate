import { db } from "../db/client";
import { payouts, sellers } from "../db/schema";
import { generateId } from "../utils/id-generator";
import { bpsOfToken } from "../utils/currency";
import { flowStateEmitter } from "../events/emitter";
import { eq, desc } from "drizzle-orm";
import type { PaginatedResult } from "../types/common";
import type { Payout } from "../db/schema";

export interface RecordPayoutInput {
  orderId: string;
  sellerId: string;
  state: string;
  escrowAmountToken: string;
  percentageBps: number;
  txHash?: string;
  platformFeeToken?: string;
  receiptIpfsCid?: string;
}

export class PayoutService {
  async recordPayout(input: RecordPayoutInput): Promise<Payout> {
    const amountToken = bpsOfToken(input.escrowAmountToken, input.percentageBps);

    const [payout] = await db
      .insert(payouts)
      .values({
        id: generateId.payout(),
        orderId: input.orderId,
        sellerId: input.sellerId,
        state: input.state,
        amountToken,
        percentageBps: input.percentageBps,
        txHash: input.txHash,
        platformFeeToken: input.platformFeeToken,
        receiptIpfsCid: input.receiptIpfsCid,
      })
      .returning();

    flowStateEmitter.emit("payout:recorded", {
      payoutId: payout.id,
      orderId: payout.orderId,
      sellerId: payout.sellerId,
      state: payout.state,
      amountToken: payout.amountToken,
      txHash: payout.txHash ?? undefined,
    });

    return payout;
  }

  async getSellerPayouts(
    sellerId: string,
    page = 1,
    limit = 20
  ): Promise<PaginatedResult<Payout>> {
    const offset = (page - 1) * limit;

    const [data, countResult] = await Promise.all([
      db
        .select()
        .from(payouts)
        .where(eq(payouts.sellerId, sellerId))
        .orderBy(desc(payouts.createdAt))
        .limit(limit)
        .offset(offset),
      db.select().from(payouts).where(eq(payouts.sellerId, sellerId)),
    ]);

    const total = countResult.length;

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
