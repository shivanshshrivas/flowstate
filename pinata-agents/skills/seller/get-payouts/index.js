const API_URL = process.env.FLOWSTATE_API_URL || 'http://localhost:3000';
const API_KEY = process.env.FLOWSTATE_API_KEY;

/**
 * Get a seller's payout history.
 * @param {Object} params
 * @param {string} params.seller_id - The seller's ID
 */
async function run({ seller_id }) {
  if (!seller_id) {
    return { error: 'seller_id is required' };
  }

  const res = await fetch(
    `${API_URL}/api/v1/sellers/${encodeURIComponent(seller_id)}/payouts`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'X-Caller-User-Id': seller_id,
        'X-Caller-Role': 'seller',
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
