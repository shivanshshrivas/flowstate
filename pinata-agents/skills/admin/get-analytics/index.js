const API_URL = process.env.FLOWSTATE_API_URL || 'http://localhost:3000';
const API_KEY = process.env.FLOWSTATE_API_KEY;

/**
 * Get platform-wide analytics.
 * @param {Object} params
 * @param {string} params.project_id - The Flow State project ID
 * @param {string} [params.period] - Time period filter
 */
async function run({ project_id, period }) {
  if (!project_id) {
    return { error: 'project_id is required' };
  }

  const url = new URL(`${API_URL}/api/v1/platform/${encodeURIComponent(project_id)}/analytics`);
  if (period) url.searchParams.set('period', period);

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'X-Caller-User-Id': project_id,
      'X-Caller-Role': 'admin',
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
