import { config } from "../config.js";

export async function apiCall(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  body?: unknown,
): Promise<unknown> {
  const res = await fetch(`${config.FLOWSTATE_API_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${config.FLOWSTATE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`FlowState API error ${res.status} on ${method} ${path}: ${text}`);
  }

  return res.json();
}
