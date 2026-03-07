import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { getOrder, getTrackingInfo, fileDispute, getReceipt, listOrdersByBuyer } from "@/lib/agents/mock-flowstate-api";

export const orderStatusTool = new DynamicStructuredTool({
  name: "get_order_status",
  description: "Get full status, escrow details, payout milestones, and shipping info for a specific order. Use when buyer asks about a specific order ID.",
  schema: z.object({ order_id: z.string().describe("The order ID, e.g. order-001") }),
  func: async ({ order_id }) => {
    const order = getOrder(order_id);
    if (!order) return JSON.stringify({ error: `Order ${order_id} not found.` });
    const released = order.payout_schedule.filter((p) => p.releasedAt).reduce((s, p) => s + p.percentageBps, 0);
    return JSON.stringify({
      id: order.id, state: order.state, seller: order.seller_name,
      items: order.items.map((i) => `${i.quantity}x ${i.product_name} ($${i.price_usd})`),
      total_usd: order.total_usd, currency: "FLUSD",
      carrier: order.carrier ?? "Not shipped yet", tracking: order.tracking_number ?? "N/A",
      escrow_remaining_token: order.escrow?.remainingAmount ?? "N/A",
      payout_released_pct: `${(released / 100).toFixed(0)}%`,
      milestones: order.payout_schedule.map((p) => ({ state: p.state, pct: `${p.percentageBps / 100}%`, released: !!p.releasedAt, tx: p.txHash ?? null })),
      created_at: order.created_at, updated_at: order.updated_at,
    });
  },
});

export const trackShipmentTool = new DynamicStructuredTool({
  name: "track_shipment",
  description: "Get real-time tracking info: carrier, current location, estimated delivery, history. Use when buyer asks where their package is.",
  schema: z.object({ order_id: z.string().describe("The order ID to track") }),
  func: async ({ order_id }) => {
    const tracking = getTrackingInfo(order_id);
    if (!tracking) {
      const order = getOrder(order_id);
      if (!order) return JSON.stringify({ error: `Order ${order_id} not found.` });
      return JSON.stringify({ order_id, message: `Order is in state "${order.state}" — no tracking available yet.` });
    }
    return JSON.stringify(tracking);
  },
});

export const fileDisputeTool = new DynamicStructuredTool({
  name: "file_dispute",
  description: "File a dispute for an order. Use when buyer reports wrong item, damage, or non-delivery. Requires order ID and reason.",
  schema: z.object({
    order_id: z.string().describe("The order ID to dispute"),
    reason: z.string().describe("Clear description of the issue"),
  }),
  func: async ({ order_id, reason }) => {
    const order = getOrder(order_id);
    if (!order) return JSON.stringify({ error: `Order ${order_id} not found.` });
    try { return JSON.stringify(fileDispute(order_id, order.buyer_wallet, reason)); }
    catch (e) { return JSON.stringify({ error: (e as Error).message }); }
  },
});

export const getReceiptTool = new DynamicStructuredTool({
  name: "get_receipt",
  description: "Get the receipt/invoice for an order: items, amounts, escrow tx, IPFS invoice URL. Use when buyer asks for proof of payment.",
  schema: z.object({ order_id: z.string().describe("The order ID") }),
  func: async ({ order_id }) => {
    const r = getReceipt(order_id);
    if (!r) return JSON.stringify({ error: `Order ${order_id} not found.` });
    return JSON.stringify(r);
  },
});

export const listMyOrdersTool = new DynamicStructuredTool({
  name: "list_my_orders",
  description: "List all orders for a buyer's wallet address. Use when buyer asks about their order history.",
  schema: z.object({ wallet: z.string().describe("The buyer's wallet address (0x...)") }),
  func: async ({ wallet }) => {
    const orders = listOrdersByBuyer(wallet);
    if (!orders.length) return JSON.stringify({ message: `No orders found for wallet ${wallet}.` });
    return JSON.stringify({
      total: orders.length,
      orders: orders.map((o) => ({ id: o.id, state: o.state, seller: o.seller_name, items: o.items.map((i) => `${i.quantity}x ${i.product_name}`), total_usd: o.total_usd, created_at: o.created_at, tracking: o.tracking_number ?? null })),
    });
  },
});

export const buyerTools = [orderStatusTool, trackShipmentTool, fileDisputeTool, getReceiptTool, listMyOrdersTool];
