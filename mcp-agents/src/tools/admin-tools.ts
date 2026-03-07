import { tool } from "@langchain/core/tools";
import { z } from "zod";
import {
  MOCK_ANALYTICS,
  MOCK_SELLERS,
  MOCK_SELLER_METRICS,
  MOCK_WEBHOOK_EVENTS,
  MOCK_GAS_REPORT,
  MOCK_DISPUTES,
  DisputeStatus,
} from "../mock-data/index.js";

/**
 * Factory — creates all 5 admin tools.
 * Admin tools have no user-level data scoping (admins see everything),
 * but session isolation still applies for chat history.
 */
export function createAdminTools() {
  // ── 1. get_analytics ───────────────────────────────────────────────────

  const getAnalyticsTool = tool(
    async ({ period }) => {
      const openDisputes = MOCK_DISPUTES.filter(
        (d) =>
          d.status !== DisputeStatus.RESOLVED &&
          d.status !== DisputeStatus.AUTO_RESOLVED,
      );

      return JSON.stringify(
        {
          period: period ?? "last_7_days",
          total_orders: MOCK_ANALYTICS.total_orders,
          total_volume_usd: MOCK_ANALYTICS.total_volume_usd,
          active_escrows: MOCK_ANALYTICS.active_escrows,
          dispute_rate_pct: (MOCK_ANALYTICS.dispute_rate * 100).toFixed(2) + "%",
          open_disputes: openDisputes.length,
          avg_dispute_resolution_hours: MOCK_ANALYTICS.avg_resolution_hours,
          daily_breakdown: MOCK_ANALYTICS.orders_by_day,
          summary: {
            avg_order_value_usd: (
              MOCK_ANALYTICS.total_volume_usd / MOCK_ANALYTICS.total_orders
            ).toFixed(2),
            health:
              MOCK_ANALYTICS.dispute_rate < 0.02
                ? "Healthy"
                : MOCK_ANALYTICS.dispute_rate < 0.05
                  ? "Monitor"
                  : "Attention Required",
          },
        },
        null,
        2,
      );
    },
    {
      name: "get_analytics",
      description:
        "Get platform-wide analytics: total order volume, revenue, dispute rate, active escrows, and daily breakdown.",
      schema: z.object({
        period: z
          .enum(["today", "last_7_days", "last_30_days", "all_time"])
          .nullish()
          .describe("Time period for analytics (note: mock data is fixed)"),
      }),
    },
  );

  // ── 2. list_sellers ────────────────────────────────────────────────────

  const listSellersTool = tool(
    async ({ status }) => {
      let sellers = MOCK_SELLERS;
      if (status) {
        sellers = sellers.filter((s) => s.status === status);
      }

      return JSON.stringify(
        {
          total: sellers.length,
          sellers: sellers.map((s) => {
            const metrics = MOCK_SELLER_METRICS[s.id];
            return {
              id: s.id,
              business_name: s.business_name,
              status: s.status,
              email: s.email,
              wallet_address: s.wallet_address,
              created_at: s.created_at,
              metrics: metrics
                ? {
                    total_orders: metrics.total_orders,
                    total_revenue_usd: metrics.total_revenue_usd,
                    dispute_rate_pct: (metrics.dispute_rate * 100).toFixed(1) + "%",
                    avg_fulfillment_hours: metrics.fulfillment_avg_hours,
                    active_escrows: metrics.active_escrows,
                  }
                : null,
            };
          }),
        },
        null,
        2,
      );
    },
    {
      name: "list_sellers",
      description:
        "List all sellers on the platform with their status, business info, and performance metrics.",
      schema: z.object({
        status: z
          .enum(["pending", "active", "suspended"])
          .nullish()
          .describe("Optional: filter sellers by status"),
      }),
    },
  );

  // ── 3. flagged_sellers ─────────────────────────────────────────────────

  const flaggedSellersTool = tool(
    async ({ threshold }) => {
      const disputeThreshold = threshold ?? 0.05; // default: flag if >5% dispute rate

      const flagged = MOCK_SELLERS.flatMap((s) => {
        const metrics = MOCK_SELLER_METRICS[s.id];
        if (!metrics || metrics.dispute_rate <= disputeThreshold) return [];

        return [
          {
            id: s.id,
            business_name: s.business_name,
            status: s.status,
            dispute_rate_pct: (metrics.dispute_rate * 100).toFixed(1) + "%",
            dispute_rate_raw: metrics.dispute_rate,
            total_orders: metrics.total_orders,
            total_revenue_usd: metrics.total_revenue_usd,
            avg_fulfillment_hours: metrics.fulfillment_avg_hours,
            risk_level:
              metrics.dispute_rate > 0.2
                ? "Critical"
                : metrics.dispute_rate > 0.1
                  ? "High"
                  : "Elevated",
            recommended_action:
              metrics.dispute_rate > 0.2
                ? "Consider suspension pending review"
                : "Monitor closely and reach out",
          },
        ];
      }).sort((a, b) => b.dispute_rate_raw - a.dispute_rate_raw);

      if (flagged.length === 0) {
        return `No sellers found with a dispute rate above ${(disputeThreshold * 100).toFixed(0)}%.`;
      }

      return JSON.stringify(
        {
          threshold_pct: (disputeThreshold * 100).toFixed(0) + "%",
          flagged_count: flagged.length,
          sellers: flagged,
        },
        null,
        2,
      );
    },
    {
      name: "flagged_sellers",
      description:
        "List sellers whose dispute rate exceeds a threshold (default 5%). Returns risk level and recommended action.",
      schema: z.object({
        threshold: z
          .number()
          .min(0)
          .max(1)
          .nullish()
          .describe(
            "Dispute rate threshold (0–1). Default is 0.05 (5%). Sellers above this are flagged.",
          ),
      }),
    },
  );

  // ── 4. webhook_logs ────────────────────────────────────────────────────

  const webhookLogsTool = tool(
    async ({ status, limit }) => {
      let events = [...MOCK_WEBHOOK_EVENTS];

      if (status) {
        events = events.filter((e) => e.status === status);
      }

      // Sort newest first
      events.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );

      const cappedLimit = Math.min(limit ?? 20, 50);
      const sliced = events.slice(0, cappedLimit);

      const stats = {
        total_shown: sliced.length,
        total_available: events.length,
        processed: events.filter((e) => e.status === "processed").length,
        failed: events.filter((e) => e.status === "failed").length,
        received: events.filter((e) => e.status === "received").length,
      };

      return JSON.stringify(
        {
          stats,
          events: sliced.map((e) => ({
            id: e.id,
            event_type: e.event_type,
            source: e.source,
            order_id: e.order_id ?? null,
            status: e.status,
            http_status: e.http_status ?? null,
            timestamp: e.timestamp,
            payload_summary: JSON.stringify(e.payload).slice(0, 120),
          })),
        },
        null,
        2,
      );
    },
    {
      name: "webhook_logs",
      description:
        "View recent webhook delivery logs, filtered by status (processed/failed/received). Shows source, event type, HTTP status, and payload summary.",
      schema: z.object({
        status: z
          .enum(["received", "processed", "failed"])
          .nullish()
          .describe("Optional: filter by delivery status"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .nullish()
          .describe("Max number of events to return (default 20, max 50)"),
      }),
    },
  );

  // ── 5. gas_report ──────────────────────────────────────────────────────

  const gasReportTool = tool(
    async () => {
      return JSON.stringify(
        {
          gas_report: {
            total_gas_spent_usd: MOCK_GAS_REPORT.total_gas_usd,
            total_on_chain_transactions: MOCK_GAS_REPORT.total_transactions,
            avg_gas_per_transition_usd: MOCK_GAS_REPORT.avg_gas_per_transition_usd,
            breakdown_by_transition: MOCK_GAS_REPORT.by_transition.map((t) => ({
              transition: t.transition,
              transaction_count: t.count,
              avg_gas_usd: t.avg_gas_usd,
              total_gas_usd: (t.count * t.avg_gas_usd).toFixed(2),
            })),
            most_expensive_transition: MOCK_GAS_REPORT.by_transition.reduce((a, b) =>
              a.avg_gas_usd > b.avg_gas_usd ? a : b,
            ).transition,
          },
        },
        null,
        2,
      );
    },
    {
      name: "gas_report",
      description:
        "Get a full gas cost report: total gas spent in USD, per-transition average costs, and transaction counts.",
      schema: z.object({}),
    },
  );

  return [getAnalyticsTool, listSellersTool, flaggedSellersTool, webhookLogsTool, gasReportTool];
}
