import { env } from "../config/env";

type AgentRole = "buyer" | "seller" | "admin";

const TOOL_MAP: Record<AgentRole, string> = {
  buyer: "buyer_agent_chat",
  seller: "seller_agent_chat",
  admin: "admin_agent_chat",
};

interface SseSession {
  sessionId: string;
  waitForNextMessage: () => Promise<unknown>;
  close: () => void;
}

async function openSseSession(baseUrl: string): Promise<SseSession> {
  return new Promise((resolveSession, rejectSession) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
      rejectSession(new Error("MCP SSE connection timed out"));
    }, 30_000);

    let resolvePending: ((v: unknown) => void) | null = null;
    let sessionResolved = false;

    fetch(`${baseUrl}/sse`, {
      signal: controller.signal,
      headers: { Accept: "text/event-stream" },
    })
      .then(async (res) => {
        if (!res.body) {
          clearTimeout(timeout);
          rejectSession(new Error("No SSE response body from MCP agents"));
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        const pump = async () => {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              const blocks = buffer.split("\n\n");
              buffer = blocks.pop() ?? "";

              for (const block of blocks) {
                const lines = block.split("\n");
                let eventType = "";
                let data = "";
                for (const line of lines) {
                  if (line.startsWith("event: ")) eventType = line.slice(7).trim();
                  else if (line.startsWith("data: ")) data = line.slice(6).trim();
                }

                if (eventType === "endpoint" && !sessionResolved) {
                  const match = data.match(/sessionId=([^&\s"]+)/);
                  if (match) {
                    sessionResolved = true;
                    clearTimeout(timeout);
                    resolveSession({
                      sessionId: match[1],
                      waitForNextMessage: () =>
                        new Promise<unknown>((resolve) => {
                          resolvePending = resolve;
                        }),
                      close: () => {
                        controller.abort();
                        reader.cancel().catch(() => {});
                      },
                    });
                  }
                } else if (eventType === "message" && data) {
                  try {
                    const parsed = JSON.parse(data);
                    if (resolvePending) {
                      const cb = resolvePending;
                      resolvePending = null;
                      cb(parsed);
                    }
                  } catch {
                    // ignore non-JSON SSE frames
                  }
                }
              }
            }
          } catch (err: any) {
            if (err?.name !== "AbortError") {
              console.error("[agent-service] SSE pump error:", err);
            }
          }
        };

        pump();
      })
      .catch((err) => {
        clearTimeout(timeout);
        rejectSession(err);
      });
  });
}

export class AgentService {
  async chat(
    _projectId: string,
    role: AgentRole,
    userId: string,
    message: string,
  ): Promise<{ response: string; role: AgentRole; suggestedActions?: string[] }> {
    const baseUrl = env.MCP_AGENTS_URL;
    const toolName = TOOL_MAP[role];

    const toolArgs: Record<string, string> = { message };
    if (role === "buyer") toolArgs.buyer_wallet = userId;
    else if (role === "seller") toolArgs.seller_id = userId;

    const session = await openSseSession(baseUrl);

    try {
      // Register listener before sending POST to avoid race
      const resultPromise = session.waitForNextMessage();

      await fetch(`${baseUrl}/message?sessionId=${session.sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "tools/call",
          id: Date.now(),
          params: { name: toolName, arguments: toolArgs },
        }),
      });

      const result = await resultPromise;
      session.close();

      const content = (result as any)?.result?.content;
      let responseText = "No response from agent.";
      if (Array.isArray(content)) {
        const textItem = content.find((c: any) => c.type === "text");
        if (textItem?.text) responseText = textItem.text;
      }

      return { response: responseText, role };
    } catch (err) {
      session.close();
      throw err;
    }
  }
}
