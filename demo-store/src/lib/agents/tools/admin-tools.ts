import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { getPlatformAnalytics, listAllSellers, getWebhookLogs, getGasReport } from "@/lib/agents/mock-flowstate-api";

export const getAnalyticsTool = new DynamicStructuredTool({
  name: "get_platform_analytics",
  description: "Get platform analytics: total order count, volume, active escrows, dispute rate, avg resolution time, daily order trends.",
  schema: z.object({}),
  func: async () => JSON.stringify(getPlatformAnalytics()),
});

export const listSellersTool = new DynamicStructuredTool({
  name: "list_all_sellers",
  description: "List all sellers with business info, status (active/suspended), and key metrics (orders, revenue, dispute rate).",
  schema: z.object({}),
  func: async () => {
    const sellers = listAllSellers(false);
    return JSON.stringify({ seller_count: sellers.length, sellers: sellers.map((s) => ({ id: s.id, business_name: s.business_name, email: s.email, status: s.status, created_at: s.created_at, metrics: { total_orders: s.metrics.total_orders, total_revenue_usd: s.metrics.total_revenue_usd, dispute_rate: `${(s.metrics.dispute_rate * 100).toFixed(1)}%`, fulfillment_avg_hours: s.metrics.fulfillment_avg_hours, active_escrows: s.metrics.active_escrows } })) });
  },
});

export const flaggedSellersTool = new DynamicStructuredTool({
  name: "get_flagged_sellers",
  description: "Get sellers flagged for high dispute rates (>5%) or suspended status.",
  schema: z.object({}),
  func: async () => {
    const sellers = listAllSellers(true);
    if (!sellers.length) return JSON.stringify({ message: "No flagged sellers.", flagged: [] });
    return JSON.stringify({ flagged_count: sellers.length, flagged: sellers.map((s) => ({ id: s.id, business_name: s.business_name, status: s.status, dispute_rate: `${(s.metrics.dispute_rate * 100).toFixed(1)}%`, total_orders: s.metrics.total_orders, reason: s.status === "suspended" ? "Account suspended" : `High dispute rate: ${(s.metrics.dispute_rate * 100).toFixed(1)}%` })) });
  },
});

export const webhookLogsTool = new DynamicStructuredTool({
  name: "get_webhook_logs",
  description: "Get recent webhook delivery logs: event types, HTTP status, timestamps, failed events.",
  schema: z.object({}),
  func: async () => {
    const events = getWebhookLogs();
    return JSON.stringify({ total_events: events.length, failed_count: events.filter((e) => e.status === "failed").length, events });
  },
});

export const gasReportTool = new DynamicStructuredTool({
  name: "get_gas_report",
  description: "Get on-chain gas cost report: total XRP spent, avg per transition, breakdown by contract function, daily trend.",
  schema: z.object({}),
  func: async () => JSON.stringify(getGasReport()),
});

export const adminTools = [getAnalyticsTool, listSellersTool, flaggedSellersTool, webhookLogsTool, gasReportTool];
