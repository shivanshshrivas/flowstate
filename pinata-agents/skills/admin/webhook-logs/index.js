const API_URL = process.env.FLOWSTATE_API_URL || 'http://localhost:3000';
const API_KEY = process.env.FLOWSTATE_API_KEY;

/**
 * Get webhook delivery logs.
 * @param {Object} params
 * @param {string} [params.status] - Filter by status: 'received', 'processed', 'failed'
 * @param {number} [params.limit] - Max results (default 20, max 50)
 */
async function run({ status, limit }) {
  const url = new URL(`${API_URL}/api/v1/webhooks/logs`);
  if (status) url.searchParams.set('status', status);
  if (limit) url.searchParams.set('limit', String(Math.min(limit, 50)));

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
