import { db } from "../db/client";
import { sellers, orders, payouts, disputes } from "../db/schema";
import { generateId } from "../utils/id-generator";
import { eq, and, desc, count, avg } from "drizzle-orm";
import { PAYOUT_DEFAULTS } from "../config/constants";
import type { OnboardSellerInput, SellerMetrics } from "../types/sellers";
import type { PaginatedResult } from "../types/common";
import type { Seller, Order, Payout } from "../db/schema";

const VALID_PAYOUT_TOTAL_BPS = 10000;

export class SellerService {
  async onboard(projectId: string, input: OnboardSellerInput): Promise<Seller> {
    // Validate payout config if provided
    if (input.payoutConfig) {
      const total =
        input.payoutConfig.labelCreatedBps +
        input.payoutConfig.shippedBps +
        input.payoutConfig.deliveredBps +
        input.payoutConfig.finalizedBps;

      if (total !== VALID_PAYOUT_TOTAL_BPS) {
        const err: any = new Error(
          `Payout config must sum to ${VALID_PAYOUT_TOTAL_BPS} bps (got ${total})`
        );
        err.statusCode = 400;
        throw err;
      }
    }

    const defaultPayoutConfig = {
      labelCreatedBps: PAYOUT_DEFAULTS.LABEL_CREATED_BPS,
      shippedBps: PAYOUT_DEFAULTS.SHIPPED_BPS,
      deliveredBps: PAYOUT_DEFAULTS.DELIVERED_BPS,
      finalizedBps: PAYOUT_DEFAULTS.FINALIZED_BPS,
    };

    const [seller] = await db
      .insert(sellers)
      .values({
        id: generateId.seller(),
        projectId,
        walletAddress: input.walletAddress,
        businessName: input.businessName,
        businessAddress: input.businessAddress as any,
        carrierAccounts: (input.carrierAccounts ?? {}) as any,
        payoutConfig: (input.payoutConfig ?? defaultPayoutConfig) as any,
        reputationScore: 100,
        isActive: true,
      })
      .returning();

    return seller;
  }

  async getOrders(
    sellerId: string,
    projectId: string,
    status?: string,
    page = 1,
    limit = 20
  ): Promise<PaginatedResult<Order>> {
    // Verify seller belongs to project
    const [seller] = await db
      .select()
      .from(sellers)
      .where(and(eq(sellers.id, sellerId), eq(sellers.projectId, projectId)))
      .limit(1);

    if (!seller) {
      const err: any = new Error("Seller not found");
      err.statusCode = 404;
      throw err;
    }

    const offset = (page - 1) * limit;

    const whereClause = status
      ? and(eq(orders.sellerId, sellerId), eq(orders.state, status as any))
      : eq(orders.sellerId, sellerId);

    const [data, allRows] = await Promise.all([
      db
        .select()
        .from(orders)
        .where(whereClause)
        .orderBy(desc(orders.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ id: orders.id }).from(orders).where(whereClause),
    ]);

    return {
      data,
      total: allRows.length,
      page,
      limit,
      totalPages: Math.ceil(allRows.length / limit),
    };
  }

  async getMetrics(
    sellerId: string,
    projectId: string,
    _periodDays = 30
  ): Promise<SellerMetrics> {
    const [seller] = await db
      .select()
      .from(sellers)
      .where(and(eq(sellers.id, sellerId), eq(sellers.projectId, projectId)))
      .limit(1);

    if (!seller) {
      const err: any = new Error("Seller not found");
      err.statusCode = 404;
      throw err;
    }

    const [sellerOrders, sellerDisputes, sellerPayouts] = await Promise.all([
      db.select().from(orders).where(eq(orders.sellerId, sellerId)),
      db.select().from(disputes).where(eq(disputes.sellerWallet, seller.walletAddress)),
      db.select().from(payouts).where(eq(payouts.sellerId, sellerId)),
    ]);

    const totalOrders = sellerOrders.length;
    const totalRevenue = sellerPayouts
      .reduce((sum, p) => sum + parseFloat(p.amountToken), 0)
      .toFixed(18);
    const disputeRate = totalOrders > 0 ? sellerDisputes.length / totalOrders : 0;

    // Average fulfillment time: LABEL_CREATED → DELIVERED
    const fulfilledOrders = sellerOrders.filter(
      (o) => o.labelCreatedAt && o.deliveredAt
    );
    const avgFulfillmentTimeDays =
      fulfilledOrders.length > 0
        ? fulfilledOrders.reduce((sum, o) => {
            const ms = o.deliveredAt!.getTime() - o.labelCreatedAt!.getTime();
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
    limit = 20
  ): Promise<PaginatedResult<Payout>> {
    // Verify ownership
    const [seller] = await db
      .select()
      .from(sellers)
      .where(and(eq(sellers.id, sellerId), eq(sellers.projectId, projectId)))
      .limit(1);

    if (!seller) {
      const err: any = new Error("Seller not found");
      err.statusCode = 404;
      throw err;
    }

    const offset = (page - 1) * limit;
    const [data, allRows] = await Promise.all([
      db
        .select()
        .from(payouts)
        .where(eq(payouts.sellerId, sellerId))
        .orderBy(desc(payouts.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ id: payouts.id }).from(payouts).where(eq(payouts.sellerId, sellerId)),
    ]);

    return {
      data,
      total: allRows.length,
      page,
      limit,
      totalPages: Math.ceil(allRows.length / limit),
    };
  }
}
