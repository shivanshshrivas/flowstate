const API_URL = process.env.FLOWSTATE_API_URL || 'http://localhost:3000';
const API_KEY = process.env.FLOWSTATE_API_KEY;

/**
 * Get the platform's on-chain gas cost report.
 * @param {Object} params
 * @param {string} params.project_id - The Flow State project ID
 */
async function run({ project_id }) {
  if (!project_id) {
    return { error: 'project_id is required' };
  }

  const res = await fetch(
    `${API_URL}/api/v1/platform/${encodeURIComponent(project_id)}/gas-costs`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'X-Caller-User-Id': project_id,
        'X-Caller-Role': 'admin',
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
