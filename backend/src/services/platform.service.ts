import { db } from "../db/client";

export class PlatformService {
  async getAnalytics(
    projectId: string,
    periodDays: number,
  ): Promise<{
    orders: { total: number; byStatus: Record<string, number> };
    revenue: { totalUsd: string; totalToken: string };
    disputes: { total: number; rate: number };
    sellers: { total: number; active: number };
  }> {
    const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

    const [ordersByState, sellerCounts, disputeResult] = await Promise.all([
      db<
        {
          state: string;
          count: string;
          totalUsd: string;
          totalToken: string;
        }[]
      >`
        select
          state,
          count(*)::text as count,
          coalesce(sum(total_usd)::text, '0') as total_usd,
          coalesce(sum(escrow_amount_token)::text, '0') as total_token
        from orders
        where project_id = ${projectId}
          and created_at >= ${since}
        group by state
      `,

      db<{ total: string; active: string }[]>`
        select
          count(*)::text as total,
          coalesce(sum(case when is_active then 1 else 0 end), 0)::text as active
        from sellers
        where project_id = ${projectId}
      `,

      db<{ count: string }[]>`
        select count(*)::text as count
        from disputes d
        inner join orders o on d.order_id = o.id
        where o.project_id = ${projectId}
          and d.created_at >= ${since}
      `,
    ]);

    const totalOrders = ordersByState.reduce(
      (sum, r) => sum + parseInt(r.count, 10),
      0,
    );

    const byStatus: Record<string, number> = {};
    let totalUsd = "0";
    let totalToken = "0";

    for (const row of ordersByState) {
      byStatus[row.state] = parseInt(row.count, 10);
      totalUsd = (parseFloat(totalUsd) + parseFloat(row.totalUsd)).toFixed(2);
      totalToken = (parseFloat(totalToken) + parseFloat(row.totalToken)).toFixed(
        18,
      );
    }

    const disputeTotal = parseInt(disputeResult[0]?.count ?? "0", 10);
    const disputeRate = totalOrders > 0 ? (disputeTotal / totalOrders) * 100 : 0;

    return {
      orders: { total: totalOrders, byStatus },
      revenue: { totalUsd, totalToken },
      disputes: { total: disputeTotal, rate: parseFloat(disputeRate.toFixed(2)) },
      sellers: {
        total: parseInt(sellerCounts[0]?.total ?? "0", 10),
        active: parseInt(sellerCounts[0]?.active ?? "0", 10),
      },
    };
  }

  async getSellers(
    projectId: string,
    flagged: boolean,
    page: number,
    limit: number,
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
    const rows = await db<
      {
        id: string;
        businessName: string;
        walletAddress: string;
        reputationScore: number;
        isActive: boolean;
        orderCount: string;
        disputeCount: string;
      }[]
    >`
      select
        s.id,
        s.business_name,
        s.wallet_address,
        s.reputation_score,
        s.is_active,
        count(distinct o.id)::text as order_count,
        count(distinct d.id)::text as dispute_count
      from sellers s
      left join orders o on o.seller_id = s.id
      left join disputes d on d.order_id = o.id
      where s.project_id = ${projectId}
      group by s.id
    `;

    const withRates = rows.map((r) => {
      const orderCount = parseInt(r.orderCount, 10);
      const disputeCount = parseInt(r.disputeCount, 10);

      return {
        id: r.id,
        businessName: r.businessName,
        walletAddress: r.walletAddress,
        reputationScore: r.reputationScore,
        isActive: r.isActive,
        orderCount,
        disputeCount,
        disputeRate:
          orderCount > 0
            ? parseFloat(((disputeCount / orderCount) * 100).toFixed(2))
            : 0,
      };
    });

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
    const rows = await db<{ state: string; count: string }[]>`
      select
        p.state,
        count(*)::text as count
      from payouts p
      inner join orders o on p.order_id = o.id
      where o.project_id = ${projectId}
        and p.tx_hash is not null
      group by p.state
    `;

    const GAS_PER_TX_XRP = 0.000012;
    const totalTransactions = rows.reduce(
      (sum, r) => sum + parseInt(r.count, 10),
      0,
    );
    const estimatedTotalGasXrp = (totalTransactions * GAS_PER_TX_XRP).toFixed(6);
    const avgGasPerTxXrp = totalTransactions > 0 ? GAS_PER_TX_XRP.toFixed(6) : "0.000000";

    const byFunction: Record<string, { count: number; estimatedGasXrp: string }> = {};
    for (const row of rows) {
      const count = parseInt(row.count, 10);
      byFunction[row.state] = {
        count,
        estimatedGasXrp: (count * GAS_PER_TX_XRP).toFixed(6),
      };
    }

    return { totalTransactions, estimatedTotalGasXrp, avgGasPerTxXrp, byFunction };
  }
}