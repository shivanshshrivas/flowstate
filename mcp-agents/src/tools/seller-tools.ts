import { tool } from "@langchain/core/tools";
import { z } from "zod";
import type { SessionContext } from "../session/session-manager.js";
import { apiCall } from "../utils/api-client.js";

/**
 * Factory — creates all 5 seller tools scoped to the current session's seller_id.
 * All tools call the live Flow State Backend API.
 */
export function createSellerTools(context: SessionContext) {
  const sellerId = context.userId;

  // ── 1. list_orders ─────────────────────────────────────────────────────

  const listOrdersTool = tool(
    async ({ status }) => {
      try {
        const query = new URLSearchParams();
        if (status) query.set("status", status);
        const data = await apiCall(
          "GET",
          `/api/v1/sellers/${sellerId}/orders?${query.toString()}`,
        );
        return JSON.stringify(data, null, 2);
      } catch (err: any) {
        return `Failed to list orders: ${err.message}`;
      }
    },
    {
      name: "list_orders",
      description:
        "List your orders, optionally filtered by status. Flags orders that need immediate action (ESCROWED = print label, DISPUTED = respond).",
      schema: z.object({
        status: z
          .enum([
            "INITIATED",
            "ESCROWED",
            "LABEL_CREATED",
            "SHIPPED",
            "IN_TRANSIT",
            "DELIVERED",
            "FINALIZED",
            "DISPUTED",
          ])
          .nullish()
          .describe("Optional: filter by order state"),
      }),
    },
  );

  // ── 2. get_metrics ─────────────────────────────────────────────────────

  const getMetricsTool = tool(
    async ({ period }) => {
      try {
        const query = new URLSearchParams();
        if (period) query.set("period", period);
        const data = await apiCall(
          "GET",
          `/api/v1/sellers/${sellerId}/metrics?${query.toString()}`,
        );
        return JSON.stringify(data, null, 2);
      } catch (err: any) {
        return `Failed to fetch metrics: ${err.message}`;
      }
    },
    {
      name: "get_metrics",
      description:
        "Get your seller performance metrics: order counts, revenue, fulfillment speed, dispute rate, and reputation score.",
      schema: z.object({
        period: z
          .enum(["today", "this_week", "this_month", "all_time"])
          .nullish()
          .describe("Time period for metrics"),
      }),
    },
  );

  // ── 3. confirm_label ───────────────────────────────────────────────────

  const confirmLabelTool = tool(
    async ({ order_id }) => {
      try {
        const data = await apiCall(
          "POST",
          `/api/v1/orders/${order_id}/confirm-label-printed`,
          { sellerWallet: sellerId },
        );
        return JSON.stringify(data, null, 2);
      } catch (err: any) {
        return `Failed to confirm label: ${err.message}`;
      }
    },
    {
      name: "confirm_label",
      description:
        "Confirm that a shipping label has been printed for an order. Triggers ESCROWED → LABEL_CREATED and releases the 15% payout.",
      schema: z.object({
        order_id: z.string().describe("The order ID for which the label was printed"),
      }),
    },
  );

  // ── 4. respond_dispute ─────────────────────────────────────────────────

  const respondDisputeTool = tool(
    async ({ dispute_id, action, evidence }) => {
      try {
        const data = await apiCall("POST", `/api/v1/disputes/${dispute_id}/respond`, {
          action,
          evidence: evidence ?? undefined,
        });
        return JSON.stringify(data, null, 2);
      } catch (err: any) {
        return `Failed to respond to dispute: ${err.message}`;
      }
    },
    {
      name: "respond_dispute",
      description:
        "Respond to an open dispute. Accept to issue a refund, or contest with evidence for admin review.",
      schema: z.object({
        dispute_id: z.string().describe("The dispute ID to respond to"),
        action: z
          .enum(["accept", "contest"])
          .describe('"accept" to agree to a refund, "contest" to dispute with evidence'),
        evidence: z
          .string()
          .nullish()
          .describe('Your evidence or explanation (required when action is "contest")'),
      }),
    },
  );

  // ── 5. get_payouts ─────────────────────────────────────────────────────

  const getPayoutsTool = tool(
    async () => {
      try {
        const data = await apiCall("GET", `/api/v1/sellers/${sellerId}/payouts`);
        return JSON.stringify(data, null, 2);
      } catch (err: any) {
        return `Failed to fetch payouts: ${err.message}`;
      }
    },
    {
      name: "get_payouts",
      description:
        "Get your complete payout history including amounts, trigger states, transaction hashes, and pending balance.",
      schema: z.object({}),
    },
  );

  return [listOrdersTool, getMetricsTool, confirmLabelTool, respondDisputeTool, getPayoutsTool];
}
