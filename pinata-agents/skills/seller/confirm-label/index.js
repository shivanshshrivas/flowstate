const API_URL = process.env.FLOWSTATE_API_URL || 'http://localhost:3000';
const API_KEY = process.env.FLOWSTATE_API_KEY;

/**
 * Confirm label printed for an order — advances state from ESCROWED to LABEL_CREATED.
 * @param {Object} params
 * @param {string} params.seller_id - The seller's ID (from SYSTEM_CONTEXT)
 * @param {string} params.order_id - The order ID for which the label was printed
 */
async function run({ seller_id, order_id }) {
  if (!seller_id) return { error: 'seller_id is required' };
  if (!order_id) return { error: 'order_id is required' };

  const res = await fetch(
    `${API_URL}/api/v1/orders/${encodeURIComponent(order_id)}/confirm-label-printed`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'X-Caller-User-Id': seller_id,
        'X-Caller-Role': 'seller',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ seller_wallet: seller_id }),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    return { error: `API returned ${res.status}`, details: text };
  }

  const data = await res.json();
  return data;
}

module.exports = { run };
