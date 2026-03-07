import { env } from "../config/env";

type AgentRole = "buyer" | "seller" | "admin";

const AGENT_URL_MAP: Record<AgentRole, keyof typeof env> = {
  buyer: "PINATA_BUYER_AGENT_URL",
  seller: "PINATA_SELLER_AGENT_URL",
  admin: "PINATA_ADMIN_AGENT_URL",
};

export class AgentService {
  async chat(
    projectId: string,
    role: AgentRole,
    userId: string,
    message: string
  ): Promise<{ response: string; role: AgentRole; suggestedActions?: string[] }> {
    const agentUrl = env[AGENT_URL_MAP[role]] as string | undefined;

    if (!agentUrl) {
      return {
        response: `Agent not configured. Set PINATA_${role.toUpperCase()}_AGENT_URL.`,
        role,
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    try {
      const res = await fetch(agentUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          user_id: userId,
          context: { project_id: projectId },
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err: any = new Error(`Agent returned ${res.status}`);
        err.statusCode = 502;
        throw err;
      }

      const json = (await res.json()) as { response?: string; suggested_actions?: string[] };

      return {
        response: json.response ?? "",
        role,
        suggestedActions: json.suggested_actions,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
