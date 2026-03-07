import { tool } from "@langchain/core/tools";
import { z } from "zod";
import type { SessionContext } from "../session/session-manager.js";
import {
  MOCK_ORDERS,
  MOCK_DISPUTES,
  DisputeStatus,
  OrderState,
} from "../mock-data/index.js";

/**
 * Factory — creates all 5 buyer tools scoped to the current session's buyer_wallet.
 * Tools never access data belonging to other buyers.
 */
export function createBuyerTools(context: SessionContext) {
  const buyerWallet = context.userId;

  // ── 1. order_status ────────────────────────────────────────────────────

  const orderStatusTool = tool(
    async ({ order_id }) => {
      const order = MOCK_ORDERS.find(
        (o) => o.id === order_id && o.buyer_wallet === buyerWallet,
      );
      if (!order) {
        return `Order "${order_id}" not found or does not belong to your account.`;
      }
      return JSON.stringify(
        {
          id: order.id,
          state: order.state,
          seller: order.seller_name,
          items: order.items,
          total_usd: order.total_usd,
          tracking_number: order.tracking_number ?? null,
          carrier: order.carrier ?? null,
          shipping_address: order.shipping_address,
          escrow: order.escrow
            ? {
                escrowId: order.escrow.escrowId,
                totalAmount: order.escrow.totalAmount,
                remainingAmount: order.escrow.remainingAmount,
              }
            : null,
          payout_schedule: order.payout_schedule,
          state_history: order.state_history,
          created_at: order.created_at,
          updated_at: order.updated_at,
        },
        null,
        2,
      );
    },
    {
      name: "order_status",
      description:
        "Get the full current status, financials, shipping info, and state history of a specific order. Only works for orders belonging to this buyer.",
      schema: z.object({
        order_id: z.string().describe("The order ID to look up (e.g. order-001)"),
      }),
    },
  );

  // ── 2. track_shipment ──────────────────────────────────────────────────

  const trackShipmentTool = tool(
    async ({ order_id }) => {
      const order = MOCK_ORDERS.find(
        (o) => o.id === order_id && o.buyer_wallet === buyerWallet,
      );
      if (!order) {
        return `Order "${order_id}" not found or does not belong to your account.`;
      }
      if (!order.tracking_number || !order.carrier) {
        return `No shipment information available yet for order "${order_id}". The seller may not have printed a label yet.`;
      }

      // Simulate tracking events based on state history
      const trackingEvents = order.state_history
        .filter((t) =>
          [OrderState.SHIPPED, OrderState.IN_TRANSIT, OrderState.DELIVERED].includes(t.to),
        )
        .map((t) => ({
          status: t.to,
          timestamp: t.timestamp,
          location:
            t.to === OrderState.SHIPPED
              ? "Carrier pickup scan"
              : t.to === OrderState.IN_TRANSIT
                ? "Regional sort facility"
                : "Delivered to address",
        }));

      const etaDays =
        order.state === OrderState.DELIVERED || order.state === OrderState.FINALIZED
          ? null
          : order.shipping_option?.estimated_days ?? null;

      return JSON.stringify(
        {
          order_id: order.id,
          carrier: order.carrier,
          tracking_number: order.tracking_number,
          current_status: order.state,
          estimated_delivery_days_remaining: etaDays,
          tracking_events: trackingEvents,
          shipping_address: order.shipping_address,
        },
        null,
        2,
      );
    },
    {
      name: "track_shipment",
      description:
        "Get carrier, tracking number, current location, ETA, and tracking history for a shipped order.",
      schema: z.object({
        order_id: z.string().describe("The order ID to track"),
      }),
    },
  );

  // ── 3. file_dispute ────────────────────────────────────────────────────

  const fileDisputeTool = tool(
    async ({ order_id, reason, description }) => {
      const order = MOCK_ORDERS.find(
        (o) => o.id === order_id && o.buyer_wallet === buyerWallet,
      );
      if (!order) {
        return `Order "${order_id}" not found or does not belong to your account.`;
      }
      if (order.state === OrderState.FINALIZED) {
        return `Cannot open a dispute on order "${order_id}" — the order has already been finalized.`;
      }
      if (order.state === OrderState.DISPUTED) {
        const existingDispute = MOCK_DISPUTES.find((d) => d.order_id === order_id);
        return `A dispute already exists for order "${order_id}" (dispute ID: ${existingDispute?.id ?? "unknown"}). Current status: ${existingDispute?.status ?? "OPEN"}.`;
      }
      if (order.state === OrderState.INITIATED || order.state === OrderState.ESCROWED) {
        return `Order "${order_id}" has not shipped yet (current state: ${order.state}). Disputes can only be filed after shipping.`;
      }

      // Simulate dispute creation — read-only, return a simulated response
      const frozenAmount = order.escrow
        ? (parseFloat(order.escrow.remainingAmount) / 1e18).toFixed(2)
        : "0.00";
      const deadlineDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      return JSON.stringify(
        {
          success: true,
          dispute_id: `dispute-sim-${order_id}`,
          order_id,
          reason,
          description,
          frozen_amount_usd: frozenAmount,
          deadline: deadlineDate,
          message:
            "Dispute filed successfully. The seller has 7 days to respond. Frozen escrow amount will not be released until the dispute is resolved.",
          next_steps: [
            "The seller will be notified immediately.",
            "You may be asked to provide photographic evidence.",
            "If no seller response within 7 days, a refund will be issued automatically.",
          ],
        },
        null,
        2,
      );
    },
    {
      name: "file_dispute",
      description:
        "File a dispute against an order. Use this when an item is damaged, wrong, or not received. Returns dispute ID, frozen escrow amount, and response deadline.",
      schema: z.object({
        order_id: z.string().describe("The order ID to dispute"),
        reason: z
          .enum(["item_damaged", "item_not_received", "wrong_item", "not_as_described", "other"])
          .describe("The reason category for the dispute"),
        description: z
          .string()
          .min(10)
          .describe("Detailed description of the issue (at least 10 characters)"),
      }),
    },
  );

  // ── 4. get_receipt ─────────────────────────────────────────────────────

  const getReceiptTool = tool(
    async ({ order_id }) => {
      const order = MOCK_ORDERS.find(
        (o) => o.id === order_id && o.buyer_wallet === buyerWallet,
      );
      if (!order) {
        return `Order "${order_id}" not found or does not belong to your account.`;
      }

      const subtotal = order.items.reduce((sum, i) => sum + i.price_usd * i.quantity, 0);
      const shippingCost = order.shipping_option?.price_usd ?? 0;

      return JSON.stringify(
        {
          receipt: {
            order_id: order.id,
            date: order.created_at,
            seller: order.seller_name,
            buyer_wallet: order.buyer_wallet,
            line_items: order.items.map((i) => ({
              product: i.product_name,
              quantity: i.quantity,
              unit_price_usd: i.price_usd,
              line_total_usd: i.price_usd * i.quantity,
            })),
            subtotal_usd: subtotal,
            shipping_usd: shippingCost,
            total_usd: order.total_usd,
            payment_method: "Escrow (MockRLUSD token)",
            escrow_id: order.escrow?.escrowId ?? null,
            ipfs_invoice_url: order.invoice_ipfs_url ?? null,
            order_state: order.state,
          },
        },
        null,
        2,
      );
    },
    {
      name: "get_receipt",
      description:
        "Retrieve the invoice/receipt for an order, including line items, totals, payment method, and IPFS document URL.",
      schema: z.object({
        order_id: z.string().describe("The order ID to get the receipt for"),
      }),
    },
  );

  // ── 5. list_my_orders ──────────────────────────────────────────────────

  const listMyOrdersTool = tool(
    async ({ status }) => {
      let orders = MOCK_ORDERS.filter((o) => o.buyer_wallet === buyerWallet);

      if (status) {
        orders = orders.filter((o) => o.state === status);
      }

      if (orders.length === 0) {
        return status
          ? `No orders found with status "${status}".`
          : "You have no orders yet.";
      }

      return JSON.stringify(
        {
          total: orders.length,
          orders: orders.map((o) => ({
            id: o.id,
            state: o.state,
            seller: o.seller_name,
            items_summary: o.items.map((i) => `${i.quantity}× ${i.product_name}`).join(", "),
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
      name: "list_my_orders",
      description:
        "List all orders for this buyer, optionally filtered by status. Returns a paginated summary of each order.",
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
          .describe("Optional: filter orders by their current state"),
      }),
    },
  );

  return [orderStatusTool, trackShipmentTool, fileDisputeTool, getReceiptTool, listMyOrdersTool];
}
