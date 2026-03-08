const API_URL = process.env.FLOWSTATE_API_URL || 'http://localhost:3000';
const API_KEY = process.env.FLOWSTATE_API_KEY;

/**
 * Respond to a buyer dispute.
 * @param {Object} params
 * @param {string} params.dispute_id - The dispute ID to respond to
 * @param {string} params.action - 'accept' or 'contest'
 * @param {string} [params.evidence] - Seller's evidence (required when contesting)
 */
async function run({ dispute_id, action, evidence }) {
  if (!dispute_id) return { error: 'dispute_id is required' };
  if (!action) return { error: 'action is required' };
  if (!['accept', 'contest'].includes(action)) {
    return { error: 'action must be either "accept" or "contest"' };
  }
  if (action === 'contest' && !evidence) {
    return { error: 'evidence is required when contesting a dispute' };
  }

  const res = await fetch(
    `${API_URL}/api/v1/disputes/${encodeURIComponent(dispute_id)}/respond`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action, evidence }),
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
