const API_URL = process.env.FLOWSTATE_API_URL || 'http://localhost:3000';
const API_KEY = process.env.FLOWSTATE_API_KEY;

/**
 * Get the receipt/invoice for a buyer's order.
 * @param {Object} params
 * @param {string} params.buyer_wallet - The buyer's wallet address (from SYSTEM_CONTEXT)
 * @param {string} params.order_id - The order ID to get the receipt for
 */
async function run({ buyer_wallet, order_id }) {
  if (!buyer_wallet) return { error: 'buyer_wallet is required' };
  if (!order_id) return { error: 'order_id is required' };

  const res = await fetch(`${API_URL}/api/v1/orders/${encodeURIComponent(order_id)}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'X-Caller-User-Id': buyer_wallet,
      'X-Caller-Role': 'buyer',
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const text = await res.text();
    return { error: `API returned ${res.status}`, details: text };
  }

  const data = await res.json();
  const order = data.data ?? data;

  // Extract receipt-relevant fields
  const items = order.items ?? [];
  const subtotal = items.reduce((sum, i) => sum + (i.price_usd ?? 0) * (i.quantity ?? 1), 0);
  const shippingCost = order.shipping_option?.price_usd ?? 0;

  return {
    receipt: {
      order_id: order.id,
      date: order.created_at,
      seller: order.seller_name,
      buyer_wallet: order.buyer_wallet,
      line_items: items.map((i) => ({
        product: i.product_name,
        quantity: i.quantity,
        unit_price_usd: i.price_usd,
        line_total_usd: i.price_usd * i.quantity,
      })),
      subtotal_usd: subtotal,
      shipping_usd: shippingCost,
      total_usd: order.total_usd,
      payment_method: 'Escrow (MockRLUSD token)',
      escrow_id: order.escrow?.escrowId ?? null,
      ipfs_invoice_url: order.invoice_ipfs_url ?? null,
      order_state: order.state,
    },
  };
}

module.exports = { run };
