const API_URL = process.env.FLOWSTATE_API_URL || 'http://localhost:3000';
const API_KEY = process.env.FLOWSTATE_API_KEY;

/**
 * Confirm label printed for an order — advances state from ESCROWED to LABEL_CREATED.
 * @param {Object} params
 * @param {string} params.order_id - The order ID for which the label was printed
 */
async function run({ order_id }) {
  if (!order_id) {
    return { error: 'order_id is required' };
  }

  const res = await fetch(
    `${API_URL}/api/v1/orders/${encodeURIComponent(order_id)}/confirm-label-printed`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
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
