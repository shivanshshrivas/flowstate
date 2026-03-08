import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { apiCall } from "../utils/api-client.js";
import { config } from "../config.js";

/**
 * Factory — creates all 5 admin tools.
 * All tools call the live Flow State Backend API using FLOWSTATE_PROJECT_ID from config.
 */
export function createAdminTools() {
  const projectId = config.FLOWSTATE_PROJECT_ID;

  // ── 1. get_analytics ───────────────────────────────────────────────────

  const getAnalyticsTool = tool(
    async ({ period }) => {
      try {
        const query = new URLSearchParams();
        if (period) query.set("period", period);
        const data = await apiCall(
          "GET",
          `/api/v1/platform/${projectId}/analytics?${query.toString()}`,
        );
        return JSON.stringify(data, null, 2);
      } catch (err: any) {
        return `Failed to fetch analytics: ${err.message}`;
      }
    },
    {
      name: "get_analytics",
      description:
        "Get platform-wide analytics: total order volume, revenue, dispute rate, active escrows, and daily breakdown.",
      schema: z.object({
        period: z
          .enum(["today", "last_7_days", "last_30_days", "all_time"])
          .nullish()
          .describe("Time period for analytics"),
      }),
    },
  );

  // ── 2. list_sellers ────────────────────────────────────────────────────

  const listSellersTool = tool(
    async ({ status }) => {
      try {
        const query = new URLSearchParams();
        if (status) query.set("status", status);
        const data = await apiCall(
          "GET",
          `/api/v1/platform/${projectId}/sellers?${query.toString()}`,
        );
        return JSON.stringify(data, null, 2);
      } catch (err: any) {
        return `Failed to list sellers: ${err.message}`;
      }
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
      try {
        const query = new URLSearchParams({ flagged: "true" });
        if (threshold !== null && threshold !== undefined) {
          query.set("threshold", String(threshold));
        }
        const data = await apiCall(
          "GET",
          `/api/v1/platform/${projectId}/sellers?${query.toString()}`,
        );
        return JSON.stringify(data, null, 2);
      } catch (err: any) {
        return `Failed to fetch flagged sellers: ${err.message}`;
      }
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
          .describe("Dispute rate threshold (0–1). Default is 0.05 (5%)."),
      }),
    },
  );

  // ── 4. webhook_logs ────────────────────────────────────────────────────

  const webhookLogsTool = tool(
    async ({ status, limit }) => {
      try {
        const query = new URLSearchParams();
        if (status) query.set("status", status);
        if (limit) query.set("limit", String(limit));
        const data = await apiCall("GET", `/api/v1/webhooks/logs?${query.toString()}`);
        return JSON.stringify(data, null, 2);
      } catch (err: any) {
        return `Failed to fetch webhook logs: ${err.message}`;
      }
    },
    {
      name: "webhook_logs",
      description:
        "View recent webhook delivery logs, filtered by status (processed/failed/received).",
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
      try {
        const data = await apiCall(
          "GET",
          `/api/v1/platform/${projectId}/gas-costs`,
        );
        return JSON.stringify(data, null, 2);
      } catch (err: any) {
        return `Failed to fetch gas report: ${err.message}`;
      }
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
