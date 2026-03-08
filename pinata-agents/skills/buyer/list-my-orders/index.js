const API_URL = process.env.FLOWSTATE_API_URL || 'http://localhost:3000';
const API_KEY = process.env.FLOWSTATE_API_KEY;

/**
 * List all orders for a buyer, optionally filtered by status.
 * @param {Object} params
 * @param {string} params.buyer_wallet - The buyer's wallet address
 * @param {string} [params.status] - Optional order state filter
 */
async function run({ buyer_wallet, status }) {
  if (!buyer_wallet) {
    return { error: 'buyer_wallet is required' };
  }

  const url = new URL(`${API_URL}/api/v1/orders`);
  url.searchParams.set('buyer', buyer_wallet);
  if (status) url.searchParams.set('status', status);

  const res = await fetch(url.toString(), {
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
