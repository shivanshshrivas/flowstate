import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { listOrdersBySeller, getSellerMetrics, confirmLabel, respondToDispute, getPayouts, getDisputeForOrder } from "@/lib/agents/mock-flowstate-api";

export const listSellerOrdersTool = new DynamicStructuredTool({
  name: "list_seller_orders",
  description: "List orders for a seller, optionally filtered by state. Use when seller asks about their orders, pending actions, or order status.",
  schema: z.object({
    seller_id: z.string().describe("The seller ID, e.g. seller-001"),
    status: z.string().optional().describe("Optional state filter: ESCROWED, LABEL_CREATED, SHIPPED, IN_TRANSIT, DELIVERED, FINALIZED, DISPUTED"),
  }),
  func: async ({ seller_id, status }) => {
    const orders = listOrdersBySeller(seller_id, status);
    if (!orders.length) return JSON.stringify({ message: `No${status ? ` ${status}` : ""} orders for seller ${seller_id}.` });
    return JSON.stringify({
      total: orders.length,
      orders: orders.map((o) => ({
        id: o.id, state: o.state, total_usd: o.total_usd,
        items: o.items.map((i) => `${i.quantity}x ${i.product_name}`).join(", "),
        ship_to: `${o.shipping_address.city}, ${o.shipping_address.state}`,
        tracking: o.tracking_number ?? "Not shipped",
        action_needed: o.state === "ESCROWED" ? "Print label → releases 15% payout" : o.state === "DISPUTED" ? "Respond to buyer dispute within 72h" : null,
        created_at: o.created_at,
      })),
    });
  },
});

export const getSellerMetricsTool = new DynamicStructuredTool({
  name: "get_seller_metrics",
  description: "Get seller performance metrics: total orders, revenue, fulfillment time, dispute rate, active escrows, pending payouts.",
  schema: z.object({ seller_id: z.string().describe("The seller ID") }),
  func: async ({ seller_id }) => {
    const m = getSellerMetrics(seller_id);
    if (!m) return JSON.stringify({ error: `No metrics for seller ${seller_id}.` });
    return JSON.stringify({ seller_id, total_orders: m.total_orders, total_revenue_usd: m.total_revenue_usd, fulfillment_avg_hours: m.fulfillment_avg_hours, dispute_rate: `${(m.dispute_rate * 100).toFixed(1)}%`, active_escrows: m.active_escrows, pending_payouts_usd: (Number(m.pending_payouts_token) / 1e18).toFixed(2) });
  },
});

export const confirmLabelTool = new DynamicStructuredTool({
  name: "confirm_label_printed",
  description: "Confirm label printed — advances order to LABEL_CREATED and releases 15% payout. Use when seller says they've printed the label.",
  schema: z.object({ order_id: z.string().describe("The order ID") }),
  func: async ({ order_id }) => {
    try { return JSON.stringify(confirmLabel(order_id)); }
    catch (e) { return JSON.stringify({ error: (e as Error).message }); }
  },
});

export const respondDisputeTool = new DynamicStructuredTool({
  name: "respond_to_dispute",
  description: "Submit seller response to a buyer dispute. Use when seller wants to contest a dispute on a specific order.",
  schema: z.object({
    order_id: z.string().describe("Order ID with an active dispute"),
    seller_id: z.string().describe("The seller's ID"),
    response: z.string().describe("Seller's response or rebuttal to the dispute claim"),
  }),
  func: async ({ order_id, seller_id, response }) => {
    const dispute = getDisputeForOrder(order_id);
    if (!dispute) return JSON.stringify({ error: `No dispute found for order ${order_id}.` });
    return JSON.stringify({ ...respondToDispute(dispute.id, seller_id, response), dispute_id: dispute.id, buyer_claim: dispute.buyer_evidence.description, deadline: dispute.deadline });
  },
});

export const getPayoutsTool = new DynamicStructuredTool({
  name: "get_payouts",
  description: "Get payout history for a seller: amount, milestone state, tx hash, timestamp. Use when seller asks about earnings or payment history.",
  schema: z.object({ seller_id: z.string().describe("The seller ID") }),
  func: async ({ seller_id }) => {
    const payouts = getPayouts(seller_id);
    if (!payouts.length) return JSON.stringify({ message: `No payouts yet for seller ${seller_id}.` });
    const total = payouts.reduce((s, p) => s + p.amount_usd, 0);
    return JSON.stringify({ seller_id, total_paid_usd: total.toFixed(2), count: payouts.length, payouts: payouts.map((p) => ({ id: p.id, order_id: p.order_id, milestone: p.state, amount_usd: p.amount_usd, tx_hash: p.tx_hash, timestamp: p.timestamp })) });
  },
});

export const sellerTools = [listSellerOrdersTool, getSellerMetricsTool, confirmLabelTool, respondDisputeTool, getPayoutsTool];
