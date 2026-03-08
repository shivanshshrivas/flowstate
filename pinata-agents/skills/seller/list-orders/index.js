const API_URL = process.env.FLOWSTATE_API_URL || 'http://localhost:3000';
const API_KEY = process.env.FLOWSTATE_API_KEY;

/**
 * List a seller's orders, optionally filtered by status.
 * @param {Object} params
 * @param {string} params.seller_id - The seller's ID
 * @param {string} [params.status] - Optional order state filter
 */
async function run({ seller_id, status }) {
  if (!seller_id) {
    return { error: 'seller_id is required' };
  }

  const url = new URL(`${API_URL}/api/v1/sellers/${encodeURIComponent(seller_id)}/orders`);
  if (status) url.searchParams.set('status', status);

  const res = await fetch(url.toString(), {
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
