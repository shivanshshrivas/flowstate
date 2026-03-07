import { tool } from "@langchain/core/tools";
import { z } from "zod";
import type { SessionContext } from "../session/session-manager.js";
import {
  MOCK_ORDERS,
  MOCK_SELLER_METRICS,
  MOCK_PAYOUT_RECORDS,
  MOCK_DISPUTES,
  DisputeStatus,
  OrderState,
} from "../mock-data/index.js";

/**
 * Factory — creates all 5 seller tools scoped to the current session's seller_id.
 * A seller can never access another seller's orders, metrics, or payouts.
 */
export function createSellerTools(context: SessionContext) {
  const sellerId = context.userId;

  // ── 1. list_orders ─────────────────────────────────────────────────────

  const listOrdersTool = tool(
    async ({ status }) => {
      let orders = MOCK_ORDERS.filter((o) => o.seller_id === sellerId);

      if (status) {
        orders = orders.filter((o) => o.state === status);
      }

      if (orders.length === 0) {
        return status
          ? `No orders with status "${status}".`
          : "You have no orders yet.";
      }

      // Flag orders that need action
      const needsAction = (state: OrderState) =>
        [OrderState.ESCROWED, OrderState.DISPUTED].includes(state);

      return JSON.stringify(
        {
          total: orders.length,
          needs_action: orders.filter((o) => needsAction(o.state)).length,
          orders: orders.map((o) => ({
            id: o.id,
            state: o.state,
            action_required:
              o.state === OrderState.ESCROWED
                ? "Print label and ship"
                : o.state === OrderState.DISPUTED
                  ? "Respond to dispute"
                  : null,
            buyer_wallet: o.buyer_wallet,
            items: o.items.map((i) => `${i.quantity}× ${i.product_name}`).join(", "),
            total_usd: o.total_usd,
            tracking_number: o.tracking_number ?? null,
            created_at: o.created_at,
            updated_at: o.updated_at,
          })),
        },
        null,
        2,
      );
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
      const metrics = MOCK_SELLER_METRICS[sellerId];
      if (!metrics) {
        return "No metrics found for your seller account.";
      }

      const orders = MOCK_ORDERS.filter((o) => o.seller_id === sellerId);
      const activeDisputes = MOCK_DISPUTES.filter(
        (d) =>
          d.seller_id === sellerId &&
          d.status !== DisputeStatus.RESOLVED &&
          d.status !== DisputeStatus.AUTO_RESOLVED,
      );

      return JSON.stringify(
        {
          seller_id: sellerId,
          period: period ?? "all-time",
          total_orders: metrics.total_orders,
          total_revenue_usd: metrics.total_revenue_usd,
          avg_fulfillment_hours: metrics.fulfillment_avg_hours,
          dispute_rate_pct: (metrics.dispute_rate * 100).toFixed(1) + "%",
          active_escrows: metrics.active_escrows,
          pending_payouts_usd: metrics.pending_payouts_usd,
          active_disputes: activeDisputes.length,
          orders_by_state: Object.values(OrderState).reduce(
            (acc, state) => {
              acc[state] = orders.filter((o) => o.state === state).length;
              return acc;
            },
            {} as Record<string, number>,
          ),
          reputation_score:
            metrics.dispute_rate < 0.03
              ? "Excellent"
              : metrics.dispute_rate < 0.07
                ? "Good"
                : metrics.dispute_rate < 0.15
                  ? "Fair"
                  : "Needs Improvement",
        },
        null,
        2,
      );
    },
    {
      name: "get_metrics",
      description:
        "Get your seller performance metrics: order counts, revenue, fulfillment speed, dispute rate, pending payouts, and reputation score.",
      schema: z.object({
        period: z
          .enum(["today", "this_week", "this_month", "all_time"])
          .nullish()
          .describe("Time period for metrics (note: mock data is all-time)"),
      }),
    },
  );

  // ── 3. confirm_label ───────────────────────────────────────────────────

  const confirmLabelTool = tool(
    async ({ order_id }) => {
      const order = MOCK_ORDERS.find(
        (o) => o.id === order_id && o.seller_id === sellerId,
      );
      if (!order) {
        return `Order "${order_id}" not found or does not belong to your seller account.`;
      }
      if (order.state !== OrderState.ESCROWED) {
        return `Cannot confirm label for order "${order_id}" — current state is "${order.state}". Label can only be confirmed when state is ESCROWED.`;
      }

      // Simulate state transition — read-only, return simulated success
      const payoutEntry = order.payout_schedule.find(
        (p) => p.state === OrderState.LABEL_CREATED,
      );
      const immediatePayoutUsd = payoutEntry
        ? ((payoutEntry.percentageBps / 10000) * order.total_usd).toFixed(2)
        : "0.00";

      return JSON.stringify(
        {
          success: true,
          order_id,
          previous_state: OrderState.ESCROWED,
          new_state: OrderState.LABEL_CREATED,
          payout_released_usd: immediatePayoutUsd,
          simulated_tx_hash: `0xsim${Date.now().toString(16)}`,
          message: `Label confirmed for order "${order_id}". ${immediatePayoutUsd} USD payout has been released from escrow. Next step: hand package to carrier.`,
        },
        null,
        2,
      );
    },
    {
      name: "confirm_label",
      description:
        "Confirm that a shipping label has been printed for an order. Triggers the state transition from ESCROWED → LABEL_CREATED and releases the immediate payout portion.",
      schema: z.object({
        order_id: z.string().describe("The order ID for which the label was printed"),
      }),
    },
  );

  // ── 4. respond_dispute ─────────────────────────────────────────────────

  const respondDisputeTool = tool(
    async ({ dispute_id, action, evidence }) => {
      const dispute = MOCK_DISPUTES.find(
        (d) => d.id === dispute_id && d.seller_id === sellerId,
      );
      if (!dispute) {
        return `Dispute "${dispute_id}" not found or does not belong to your seller account.`;
      }
      if (
        dispute.status === DisputeStatus.RESOLVED ||
        dispute.status === DisputeStatus.AUTO_RESOLVED
      ) {
        return `Dispute "${dispute_id}" is already resolved (status: ${dispute.status}).`;
      }

      const outcomeMessage =
        action === "accept"
          ? "You have accepted the dispute. A full refund will be issued to the buyer and the frozen escrow amount will be returned."
          : `You have contested the dispute. Your evidence has been recorded. An admin will review both parties' evidence within 48 hours. Evidence submitted: "${evidence ?? "(none)"}"`;

      return JSON.stringify(
        {
          success: true,
          dispute_id,
          order_id: dispute.order_id,
          action,
          new_status:
            action === "accept" ? "RESOLVED" : DisputeStatus.SELLER_RESPONDED,
          resolution: action === "accept" ? "refund_buyer" : "pending_review",
          message: outcomeMessage,
        },
        null,
        2,
      );
    },
    {
      name: "respond_dispute",
      description:
        "Respond to an open dispute. Accept to issue a refund, or contest with evidence for admin review.",
      schema: z.object({
        dispute_id: z.string().describe("The dispute ID to respond to"),
        action: z
          .enum(["accept", "contest"])
          .describe(
            '"accept" to agree to a refund, "contest" to dispute with evidence',
          ),
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
      const payouts = MOCK_PAYOUT_RECORDS.filter((p) => p.seller_id === sellerId);
      const metrics = MOCK_SELLER_METRICS[sellerId];

      if (payouts.length === 0) {
        return "No payout records found for your account yet.";
      }

      const totalPaid = payouts.reduce((sum, p) => sum + p.amount_usd, 0);

      return JSON.stringify(
        {
          seller_id: sellerId,
          total_paid_usd: totalPaid.toFixed(2),
          pending_payouts_usd: metrics?.pending_payouts_usd ?? 0,
          payout_count: payouts.length,
          payouts: payouts.map((p) => ({
            id: p.id,
            order_id: p.order_id,
            trigger_state: p.state,
            amount_usd: p.amount_usd,
            tx_hash: p.tx_hash,
            timestamp: p.timestamp,
          })),
        },
        null,
        2,
      );
    },
    {
      name: "get_payouts",
      description:
        "Get your complete payout history including amounts, trigger states (e.g. SHIPPED), transaction hashes, and pending balance.",
      schema: z.object({}),
    },
  );

  return [listOrdersTool, getMetricsTool, confirmLabelTool, respondDisputeTool, getPayoutsTool];
}
