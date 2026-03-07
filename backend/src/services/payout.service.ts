import { db } from "../db/client";
import type { Payout } from "../db/types";
import { generateId } from "../utils/id-generator";
import { bpsOfToken } from "../utils/currency";
import { flowStateEmitter } from "../events/emitter";
import type { PaginatedResult } from "../types/common";

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

    const rows = await db<Payout[]>`
      insert into payouts (
        id,
        order_id,
        seller_id,
        state,
        amount_token,
        percentage_bps,
        tx_hash,
        platform_fee_token,
        receipt_ipfs_cid
      ) values (
        ${generateId.payout()},
        ${input.orderId},
        ${input.sellerId},
        ${input.state},
        ${amountToken},
        ${input.percentageBps},
        ${input.txHash ?? null},
        ${input.platformFeeToken ?? null},
        ${input.receiptIpfsCid ?? null}
      )
      returning *
    `;

    const payout = rows[0];

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
    limit = 20,
  ): Promise<PaginatedResult<Payout>> {
    const offset = (page - 1) * limit;

    const [data, countRows] = await Promise.all([
      db<Payout[]>`
        select *
        from payouts
        where seller_id = ${sellerId}
        order by created_at desc
        limit ${limit}
        offset ${offset}
      `,
      db<{ count: string }[]>`
        select count(*)::text as count
        from payouts
        where seller_id = ${sellerId}
      `,
    ]);

    const total = parseInt(countRows[0]?.count ?? "0", 10);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}