const API_URL = process.env.FLOWSTATE_API_URL || 'http://localhost:3000';
const API_KEY = process.env.FLOWSTATE_API_KEY;

/**
 * Get the full status of a buyer's order.
 * @param {Object} params
 * @param {string} params.buyer_wallet - The buyer's wallet address (from SYSTEM_CONTEXT)
 * @param {string} params.order_id - The order ID to look up
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
  return data;
}

module.exports = { run };
