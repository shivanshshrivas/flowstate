const API_URL = process.env.FLOWSTATE_API_URL || 'http://localhost:3000';
const API_KEY = process.env.FLOWSTATE_API_KEY;

/**
 * Get the full status of a buyer's order.
 * @param {Object} params
 * @param {string} params.order_id - The order ID to look up
 */
async function run({ order_id }) {
  if (!order_id) {
    return { error: 'order_id is required' };
  }

  const res = await fetch(`${API_URL}/api/v1/orders/${encodeURIComponent(order_id)}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
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
