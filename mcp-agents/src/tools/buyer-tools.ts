import { tool } from "@langchain/core/tools";
import { z } from "zod";
import type { SessionContext } from "../session/session-manager.js";
import { apiCall } from "../utils/api-client.js";

/**
 * Factory — creates all 5 buyer tools scoped to the current session's buyer_wallet.
 * All tools call the live Flow State Backend API.
 */
export function createBuyerTools(context: SessionContext) {
  const buyerWallet = context.userId;

  // ── 1. order_status ────────────────────────────────────────────────────

  const orderStatusTool = tool(
    async ({ order_id }) => {
      try {
        const data = await apiCall("GET", `/api/v1/orders/${order_id}`);
        const order = (data as any)?.order;
        if (!order) return `Order "${order_id}" not found.`;
        if (order.buyerWallet?.toLowerCase() !== buyerWallet.toLowerCase()) {
          return `Order "${order_id}" does not belong to your account.`;
        }
        return JSON.stringify(
          {
            id: order.id,
            state: order.state,
            totalUsd: order.totalUsd,
            escrowAmountToken: order.escrowAmountToken,
            trackingNumber: order.trackingNumber ?? null,
            carrier: order.carrier ?? null,
            createdAt: order.createdAt,
            updatedAt: order.updatedAt,
          },
          null,
          2,
        );
      } catch (err: any) {
        return `Failed to fetch order status: ${err.message}`;
      }
    },
    {
      name: "order_status",
      description:
        "Get the full current status, financials, shipping info, and state history of a specific order. Only works for orders belonging to this buyer.",
      schema: z.object({
        order_id: z.string().describe("The order ID to look up (e.g. fs_ord_abc123)"),
      }),
    },
  );

  // ── 2. track_shipment ──────────────────────────────────────────────────

  const trackShipmentTool = tool(
    async ({ order_id }) => {
      try {
        const data = await apiCall("GET", `/api/v1/shipping/track/${order_id}`);
        return JSON.stringify(data, null, 2);
      } catch (err: any) {
        return `Failed to fetch tracking info: ${err.message}`;
      }
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
      try {
        const data = await apiCall("POST", `/api/v1/disputes/create`, {
          orderId: order_id,
          buyerWallet,
          reason,
          description,
        });
        return JSON.stringify(data, null, 2);
      } catch (err: any) {
        return `Failed to file dispute: ${err.message}`;
      }
    },
    {
      name: "file_dispute",
      description:
        "File a dispute against an order. Use this when an item is damaged, wrong, or not received.",
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
      try {
        const data = await apiCall("GET", `/api/v1/orders/${order_id}`);
        const order = (data as any)?.order;
        const items = (data as any)?.items ?? [];
        if (!order) return `Order "${order_id}" not found.`;
        if (order.buyerWallet?.toLowerCase() !== buyerWallet.toLowerCase()) {
          return `Order "${order_id}" does not belong to your account.`;
        }
        return JSON.stringify(
          {
            receipt: {
              order_id: order.id,
              date: order.createdAt,
              buyer_wallet: order.buyerWallet,
              seller_wallet: order.sellerWallet,
              line_items: items.map((i: any) => ({
                product: i.name,
                quantity: i.quantity,
                unit_price_usd: i.unitPriceUsd,
              })),
              subtotal_usd: order.subtotalUsd,
              total_usd: order.totalUsd,
              escrow_amount_token: order.escrowAmountToken,
              invoice_cid: order.invoiceIpfsCid ?? null,
              order_state: order.state,
            },
          },
          null,
          2,
        );
      } catch (err: any) {
        return `Failed to fetch receipt: ${err.message}`;
      }
    },
    {
      name: "get_receipt",
      description:
        "Retrieve the invoice/receipt for an order, including line items, totals, and IPFS document CID.",
      schema: z.object({
        order_id: z.string().describe("The order ID to get the receipt for"),
      }),
    },
  );

  // ── 5. list_my_orders ──────────────────────────────────────────────────

  const listMyOrdersTool = tool(
    async ({ status }) => {
      try {
        const query = new URLSearchParams({ buyer: buyerWallet });
        if (status) query.set("status", status);
        const data = await apiCall("GET", `/api/v1/orders?${query.toString()}`);
        return JSON.stringify(data, null, 2);
      } catch (err: any) {
        return `Failed to list orders: ${err.message}`;
      }
    },
    {
      name: "list_my_orders",
      description:
        "List all orders for this buyer, optionally filtered by status.",
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
