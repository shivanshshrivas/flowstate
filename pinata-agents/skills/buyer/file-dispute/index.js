const API_URL = process.env.FLOWSTATE_API_URL || 'http://localhost:3000';
const API_KEY = process.env.FLOWSTATE_API_KEY;

const VALID_REASONS = ['item_damaged', 'item_not_received', 'wrong_item', 'not_as_described', 'other'];

/**
 * File a dispute for a buyer's order.
 * @param {Object} params
 * @param {string} params.order_id - The order ID to dispute
 * @param {string} params.reason - Dispute reason category
 * @param {string} params.description - Detailed description of the issue
 */
async function run({ order_id, reason, description }) {
  if (!order_id) return { error: 'order_id is required' };
  if (!reason) return { error: 'reason is required' };
  if (!VALID_REASONS.includes(reason)) {
    return { error: `reason must be one of: ${VALID_REASONS.join(', ')}` };
  }
  if (!description || description.length < 10) {
    return { error: 'description must be at least 10 characters' };
  }

  const res = await fetch(`${API_URL}/api/v1/disputes/create`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ order_id, reason, description }),
  });

  if (!res.ok) {
    const text = await res.text();
    return { error: `API returned ${res.status}`, details: text };
  }

  const data = await res.json();
  return data;
}

module.exports = { run };
