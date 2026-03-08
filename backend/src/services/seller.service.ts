import { db } from "../db/client";
import type { Seller, Order, Payout, Dispute } from "../db/types";
import { generateId } from "../utils/id-generator";
import { PAYOUT_DEFAULTS } from "../config/constants";
import type { OnboardSellerInput, SellerMetrics } from "../types/sellers";
import type { PaginatedResult } from "../types/common";
import { toDate } from "../db/utils";

const VALID_PAYOUT_TOTAL_BPS = 10000;

export class SellerService {
  async onboard(projectId: string, input: OnboardSellerInput): Promise<Seller> {
    if (input.payoutConfig) {
      const total =
        input.payoutConfig.labelCreatedBps +
        input.payoutConfig.shippedBps +
        input.payoutConfig.inTransitBps +
        input.payoutConfig.deliveredBps +
        input.payoutConfig.finalizedBps;

      if (total !== VALID_PAYOUT_TOTAL_BPS) {
        const err: any = new Error(
          `Payout config must sum to ${VALID_PAYOUT_TOTAL_BPS} bps (got ${total})`,
        );
        err.statusCode = 400;
        throw err;
      }
    }

    const defaultPayoutConfig = {
      labelCreatedBps: PAYOUT_DEFAULTS.LABEL_CREATED_BPS,
      shippedBps: PAYOUT_DEFAULTS.SHIPPED_BPS,
      inTransitBps: PAYOUT_DEFAULTS.IN_TRANSIT_BPS,
      deliveredBps: PAYOUT_DEFAULTS.DELIVERED_BPS,
      finalizedBps: PAYOUT_DEFAULTS.FINALIZED_BPS,
    };

    const rows = await db<Seller[]>`
      insert into sellers (
        id,
        project_id,
        wallet_address,
        business_name,
        business_address,
        carrier_accounts,
        payout_config,
        reputation_score,
        is_active
      ) values (
        ${generateId.seller()},
        ${projectId},
        ${input.walletAddress},
        ${input.businessName},
        ${db.json(input.businessAddress as any)},
        ${db.json((input.carrierAccounts ?? {}) as any)},
        ${db.json((input.payoutConfig ?? defaultPayoutConfig) as any)},
        100,
        true
      )
      returning *
    `;

    return rows[0];
  }

  async getOrders(
    sellerId: string,
    projectId: string,
    status?: string,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResult<Order>> {
    const sellerRows = await db<Seller[]>`
      select *
      from sellers
      where id = ${sellerId}
        and project_id = ${projectId}
      limit 1
    `;

    if (!sellerRows[0]) {
      const err: any = new Error("Seller not found");
      err.statusCode = 404;
      throw err;
    }

    const offset = (page - 1) * limit;

    const [data, countRows] = await Promise.all([
      status
        ? db<Order[]>`
            select *
            from orders
            where seller_id = ${sellerId}
              and state = ${status}
            order by created_at desc
            limit ${limit}
            offset ${offset}
          `
        : db<Order[]>`
            select *
            from orders
            where seller_id = ${sellerId}
            order by created_at desc
            limit ${limit}
            offset ${offset}
          `,
      status
        ? db<{ count: string }[]>`
            select count(*)::text as count
            from orders
            where seller_id = ${sellerId}
              and state = ${status}
          `
        : db<{ count: string }[]>`
            select count(*)::text as count
            from orders
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

  async getMetrics(
    sellerId: string,
    projectId: string,
    _periodDays = 30,
  ): Promise<SellerMetrics> {
    const sellerRows = await db<Seller[]>`
      select *
      from sellers
      where id = ${sellerId}
        and project_id = ${projectId}
      limit 1
    `;

    const seller = sellerRows[0];

    if (!seller) {
      const err: any = new Error("Seller not found");
      err.statusCode = 404;
      throw err;
    }

    const [sellerOrders, sellerDisputes, sellerPayouts] = await Promise.all([
      db<Order[]>`select * from orders where seller_id = ${sellerId}`,
      db<Dispute[]>`
        select *
        from disputes
        where seller_wallet = ${seller.walletAddress}
      `,
      db<Payout[]>`select * from payouts where seller_id = ${sellerId}`,
    ]);

    const totalOrders = sellerOrders.length;
    const totalRevenue = sellerPayouts
      .reduce((sum, p) => sum + parseFloat(p.amountToken), 0)
      .toFixed(18);
    const disputeRate = totalOrders > 0 ? sellerDisputes.length / totalOrders : 0;

    const fulfilledOrders = sellerOrders.filter(
      (o) => toDate(o.labelCreatedAt) && toDate(o.deliveredAt),
    );

    const avgFulfillmentTimeDays =
      fulfilledOrders.length > 0
        ? fulfilledOrders.reduce((sum, o) => {
            const deliveredAt = toDate(o.deliveredAt)!;
            const labelCreatedAt = toDate(o.labelCreatedAt)!;
            const ms = deliveredAt.getTime() - labelCreatedAt.getTime();
            return sum + ms / (1000 * 60 * 60 * 24);
          }, 0) / fulfilledOrders.length
        : null;

    return {
      totalOrders,
      totalRevenue,
      avgFulfillmentTimeDays,
      disputeRate,
      reputationScore: seller.reputationScore,
    };
  }

  async getPayouts(
    sellerId: string,
    projectId: string,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResult<Payout>> {
    const sellerRows = await db<Seller[]>`
      select *
      from sellers
      where id = ${sellerId}
        and project_id = ${projectId}
      limit 1
    `;

    if (!sellerRows[0]) {
      const err: any = new Error("Seller not found");
      err.statusCode = 404;
      throw err;
    }

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
