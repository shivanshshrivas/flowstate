import { db } from "../db/client";
import { orders, sellers, payouts, disputes } from "../db/schema";
import { eq, and, gte, isNotNull, sql } from "drizzle-orm";

export class PlatformService {
  async getAnalytics(
    projectId: string,
    periodDays: number
  ): Promise<{
    orders: { total: number; byStatus: Record<string, number> };
    revenue: { totalUsd: string; totalToken: string };
    disputes: { total: number; rate: number };
    sellers: { total: number; active: number };
  }> {
    const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

    const [ordersByState, sellerCounts, disputeResult] = await Promise.all([
      db
        .select({
          state: orders.state,
          count: sql<number>`cast(count(*) as int)`,
          totalUsd: sql<string>`coalesce(sum(${orders.totalUsd}), '0')`,
          totalToken: sql<string>`coalesce(sum(${orders.escrowAmountToken}), '0')`,
        })
        .from(orders)
        .where(and(eq(orders.projectId, projectId), gte(orders.createdAt, since)))
        .groupBy(orders.state),

      db
        .select({
          total: sql<number>`cast(count(*) as int)`,
          active: sql<number>`cast(sum(case when ${sellers.isActive} then 1 else 0 end) as int)`,
        })
        .from(sellers)
        .where(eq(sellers.projectId, projectId)),

      db
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(disputes)
        .innerJoin(orders, eq(disputes.orderId, orders.id))
        .where(and(eq(orders.projectId, projectId), gte(disputes.createdAt, since))),
    ]);

    const totalOrders = ordersByState.reduce((sum, r) => sum + r.count, 0);
    const byStatus: Record<string, number> = {};
    let totalUsd = "0";
    let totalToken = "0";
    for (const row of ordersByState) {
      byStatus[row.state] = row.count;
      totalUsd = (parseFloat(totalUsd) + parseFloat(row.totalUsd)).toFixed(2);
      totalToken = (parseFloat(totalToken) + parseFloat(row.totalToken)).toFixed(18);
    }

    const disputeTotal = disputeResult[0]?.count ?? 0;
    const disputeRate = totalOrders > 0 ? (disputeTotal / totalOrders) * 100 : 0;

    return {
      orders: { total: totalOrders, byStatus },
      revenue: { totalUsd, totalToken },
      disputes: { total: disputeTotal, rate: parseFloat(disputeRate.toFixed(2)) },
      sellers: {
        total: sellerCounts[0]?.total ?? 0,
        active: sellerCounts[0]?.active ?? 0,
      },
    };
  }

  async getSellers(
    projectId: string,
    flagged: boolean,
    page: number,
    limit: number
  ): Promise<{
    data: Array<{
      id: string;
      businessName: string;
      walletAddress: string;
      reputationScore: number;
      isActive: boolean;
      orderCount: number;
      disputeCount: number;
      disputeRate: number;
    }>;
    total: number;
    page: number;
    limit: number;
  }> {
    const rows = await db
      .select({
        id: sellers.id,
        businessName: sellers.businessName,
        walletAddress: sellers.walletAddress,
        reputationScore: sellers.reputationScore,
        isActive: sellers.isActive,
        orderCount: sql<number>`cast(count(distinct ${orders.id}) as int)`,
        disputeCount: sql<number>`cast(count(distinct ${disputes.id}) as int)`,
      })
      .from(sellers)
      .leftJoin(orders, eq(orders.sellerId, sellers.id))
      .leftJoin(disputes, eq(disputes.orderId, orders.id))
      .where(eq(sellers.projectId, projectId))
      .groupBy(sellers.id);

    const withRates = rows.map((r) => ({
      ...r,
      disputeRate: r.orderCount > 0 ? parseFloat(((r.disputeCount / r.orderCount) * 100).toFixed(2)) : 0,
    }));

    const filtered = flagged ? withRates.filter((r) => r.disputeRate > 5) : withRates;
    const total = filtered.length;
    const data = filtered.slice((page - 1) * limit, page * limit);

    return { data, total, page, limit };
  }

  async getGasCosts(projectId: string): Promise<{
    totalTransactions: number;
    estimatedTotalGasXrp: string;
    avgGasPerTxXrp: string;
    byFunction: Record<string, { count: number; estimatedGasXrp: string }>;
  }> {
    const rows = await db
      .select({
        state: payouts.state,
        count: sql<number>`cast(count(*) as int)`,
      })
      .from(payouts)
      .innerJoin(orders, eq(payouts.orderId, orders.id))
      .where(and(eq(orders.projectId, projectId), isNotNull(payouts.txHash)))
      .groupBy(payouts.state);

    // Mock gas estimates per payout state (blockchain is stubbed)
    const GAS_PER_TX_XRP = 0.000012;
    const totalTransactions = rows.reduce((sum, r) => sum + r.count, 0);
    const estimatedTotalGasXrp = (totalTransactions * GAS_PER_TX_XRP).toFixed(6);
    const avgGasPerTxXrp = totalTransactions > 0 ? GAS_PER_TX_XRP.toFixed(6) : "0.000000";

    const byFunction: Record<string, { count: number; estimatedGasXrp: string }> = {};
    for (const row of rows) {
      byFunction[row.state] = {
        count: row.count,
        estimatedGasXrp: (row.count * GAS_PER_TX_XRP).toFixed(6),
      };
    }

    return { totalTransactions, estimatedTotalGasXrp, avgGasPerTxXrp, byFunction };
  }
}
