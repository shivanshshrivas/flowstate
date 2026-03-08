import WebSocket from "ws";
import { env } from "../config/env";

type AgentRole = "buyer" | "seller" | "admin";

const AGENT_URL_MAP: Record<AgentRole, keyof typeof env> = {
  buyer: "PINATA_BUYER_AGENT_URL",
  seller: "PINATA_SELLER_AGENT_URL",
  admin: "PINATA_ADMIN_AGENT_URL",
};

const AGENT_TOKEN_MAP: Record<AgentRole, keyof typeof env> = {
  buyer: "PINATA_BUYER_AGENT_TOKEN",
  seller: "PINATA_SELLER_AGENT_TOKEN",
  admin: "PINATA_ADMIN_AGENT_TOKEN",
};

export class AgentService {
  async chat(
    projectId: string,
    role: AgentRole,
    userId: string,
    message: string
  ): Promise<{ response: string; role: AgentRole; suggestedActions?: string[] }> {
    const agentUrl = env[AGENT_URL_MAP[role]] as string | undefined;
    const agentToken = env[AGENT_TOKEN_MAP[role]] as string | undefined;

    if (!agentUrl || !agentToken) {
      return {
        response: `Agent not configured. Set PINATA_${role.toUpperCase()}_AGENT_URL and PINATA_${role.toUpperCase()}_AGENT_TOKEN.`,
        role,
      };
    }

    // Convert https:// to wss:// if needed, append token
    const wsUrl = agentUrl.replace(/^https?:\/\//, "wss://").replace(/\/$/, "");
    const wsUrlWithToken = `${wsUrl}?token=${agentToken}`;

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrlWithToken, { family: 4, headers: { origin: "https://agents.pinata.cloud" } });
      let responseText = "";
      const timeout = setTimeout(() => {
        ws.terminate();
        reject(new Error("Agent WebSocket timed out"));
      }, 30_000);

      ws.on("open", () => {
        console.log("[agent-ws] connected, awaiting challenge...");
      });

      ws.on("message", (data) => {
        const raw = data.toString();
        console.log("[agent-ws] raw message:", raw);
        try {
          const parsed = JSON.parse(raw);

          // Step 1: server sends challenge → respond with connect request
          if (parsed.type === "event" && parsed.event === "connect.challenge") {
            const connectReq = JSON.stringify({
              type: "req",
              method: "connect",
              id: `${Date.now()}-connect`,
              params: {
                minProtocol: 3,
                maxProtocol: 3,
                client: { id: "webchat", displayName: "FlowState", version: "1.0.0", platform: "node", mode: "webchat" },
                role: "operator",
                scopes: ["operator.admin", "operator.approvals", "operator.pairing"],
                caps: [],
                commands: [],
                permissions: {},
                auth: { token: agentToken },
                locale: "en-US",
                userAgent: "flowstate-backend/1.0.0",
              },
            });
            console.log("[agent-ws] sending connect:", connectReq);
            ws.send(connectReq);
            return;
          }

          // Step 2: connect accepted → send chat message
          if (parsed.type === "res" && parsed.ok === true && parsed.id?.endsWith("-connect")) {
            const idempotencyKey = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
            const sessionKey = `user:${userId}`;
            const wrappedMessage = `[SYSTEM_CONTEXT: user_id=${userId}, role=${role}]\n\n${message}`;
            const chatReq = JSON.stringify({
              type: "req",
              method: "chat.send",
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
              params: {
                sessionKey,
                idempotencyKey,
                message: wrappedMessage,
              },
            });
            console.log("[agent-ws] sending chat:", chatReq);
            ws.send(chatReq);
            return;
          }

          // Step 3: accumulate streaming response chunks
          if (parsed.type === "event" && parsed.event === "agent") {
            const stream = parsed.payload?.stream;
            const data = parsed.payload?.data;

            if (stream === "lifecycle" && (data?.phase === "end" || data?.phase === "done")) {
              clearTimeout(timeout);
              ws.close();
              resolve({ response: responseText, role });
              return;
            }

            if (stream === "assistant" && data?.text) {
              responseText = data.text; // always the full accumulated text
            }
          }
        } catch {
          // Non-JSON frame — ignore
        }
      });

      ws.on("close", () => {
        clearTimeout(timeout);
        resolve({ response: responseText || "No response received from agent.", role });
      });

      ws.on("error", (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }
}
