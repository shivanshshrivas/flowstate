const API_URL = process.env.FLOWSTATE_API_URL || 'http://localhost:3000';
const API_KEY = process.env.FLOWSTATE_API_KEY;

/**
 * List sellers with dispute rate above threshold.
 * @param {Object} params
 * @param {string} params.project_id - The Flow State project ID
 * @param {number} [params.threshold] - Dispute rate threshold (0-1), defaults to 0.05
 */
async function run({ project_id, threshold }) {
  if (!project_id) {
    return { error: 'project_id is required' };
  }

  const url = new URL(`${API_URL}/api/v1/platform/${encodeURIComponent(project_id)}/sellers`);
  url.searchParams.set('flagged', 'true');
  if (threshold !== undefined) url.searchParams.set('threshold', String(threshold));

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
