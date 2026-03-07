import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { config } from "./config.js";
import { SessionManager } from "./session/session-manager.js";
import { runBuyerAgent } from "./agents/buyer-agent.js";
import { runSellerAgent } from "./agents/seller-agent.js";
import { runAdminAgent } from "./agents/admin-agent.js";

// ─── Session Manager (singleton) ──────────────────────────────────────────

const sessionManager = new SessionManager();

// ─── MCP Tool Definitions ─────────────────────────────────────────────────

const MCP_TOOLS: Tool[] = [
  {
    name: "buyer_agent_chat",
    description:
      "Chat with the Flow State buyer support agent. Handles order status, shipment tracking, dispute filing, receipts, and order history. Pass a session_id to continue a previous conversation.",
    inputSchema: {
      type: "object",
      properties: {
        message: {
          type: "string",
          description: "Your message or question for the buyer support agent",
        },
        session_id: {
          type: "string",
          description:
            "Optional: resume a previous session. If omitted, a new session is created.",
        },
        buyer_wallet: {
          type: "string",
          description:
            "Your Ethereum wallet address (required for new sessions, e.g. 0xf39Fd6e...)",
        },
      },
      required: ["message"],
    },
  },
  {
    name: "seller_agent_chat",
    description:
      "Chat with the Flow State seller operations agent. Handles order management, performance metrics, label confirmation, dispute responses, and payout history.",
    inputSchema: {
      type: "object",
      properties: {
        message: {
          type: "string",
          description: "Your message or question for the seller operations agent",
        },
        session_id: {
          type: "string",
          description:
            "Optional: resume a previous session. If omitted, a new session is created.",
        },
        seller_id: {
          type: "string",
          description:
            "Your seller ID (required for new sessions, e.g. seller-001)",
        },
      },
      required: ["message"],
    },
  },
  {
    name: "admin_agent_chat",
    description:
      "Chat with the Flow State platform admin agent. Handles platform analytics, seller monitoring, flagged sellers, webhook logs, and gas cost reporting.",
    inputSchema: {
      type: "object",
      properties: {
        message: {
          type: "string",
          description: "Your message or question for the platform admin agent",
        },
        session_id: {
          type: "string",
          description:
            "Optional: resume a previous session. If omitted, a new session is created.",
        },
      },
      required: ["message"],
    },
  },
];

// ─── Input Schemas ─────────────────────────────────────────────────────────

const BuyerInputSchema = z.object({
  message: z.string().min(1),
  session_id: z.string().optional(),
  buyer_wallet: z.string().optional(),
});

const SellerInputSchema = z.object({
  message: z.string().min(1),
  session_id: z.string().optional(),
  seller_id: z.string().optional(),
});

const AdminInputSchema = z.object({
  message: z.string().min(1),
  session_id: z.string().optional(),
});

// ─── MCP Server ────────────────────────────────────────────────────────────

const mcpServer = new Server(
  { name: "flowstate-mcp-agents", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

mcpServer.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: MCP_TOOLS,
}));

mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "buyer_agent_chat") {
      const parsed = BuyerInputSchema.parse(args);

      // Resolve or create session
      const userId =
        parsed.buyer_wallet ?? parsed.session_id ?? "anonymous-buyer";
      const { session, isNew, wasExpired } = sessionManager.resolve(
        "buyer",
        userId,
        parsed.session_id,
      );

      let prefix = "";
      if (wasExpired) {
        prefix =
          "Note: Your previous session has expired. Starting a new session.\n\n";
      }

      const result = await runBuyerAgent(parsed.message, session, sessionManager);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              response: prefix + result.response,
              session_id: result.session_id,
              is_new_session: isNew || wasExpired,
              active_sessions: sessionManager.activeCount,
            }),
          },
        ],
      };
    }

    if (name === "seller_agent_chat") {
      const parsed = SellerInputSchema.parse(args);

      const userId =
        parsed.seller_id ?? parsed.session_id ?? "anonymous-seller";
      const { session, isNew, wasExpired } = sessionManager.resolve(
        "seller",
        userId,
        parsed.session_id,
      );

      let prefix = "";
      if (wasExpired) {
        prefix =
          "Note: Your previous session has expired. Starting a new session.\n\n";
      }

      const result = await runSellerAgent(parsed.message, session, sessionManager);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              response: prefix + result.response,
              session_id: result.session_id,
              is_new_session: isNew || wasExpired,
              active_sessions: sessionManager.activeCount,
            }),
          },
        ],
      };
    }

    if (name === "admin_agent_chat") {
      const parsed = AdminInputSchema.parse(args);

      const { session, isNew, wasExpired } = sessionManager.resolve(
        "admin",
        "admin",
        parsed.session_id,
      );

      let prefix = "";
      if (wasExpired) {
        prefix =
          "Note: Your previous session has expired. Starting a new session.\n\n";
      }

      const result = await runAdminAgent(parsed.message, session, sessionManager);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              response: prefix + result.response,
              session_id: result.session_id,
              is_new_session: isNew || wasExpired,
              active_sessions: sessionManager.activeCount,
            }),
          },
        ],
      };
    }

    return {
      isError: true,
      content: [{ type: "text", text: `Unknown tool: "${name}"` }],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      isError: true,
      content: [{ type: "text", text: `Error: ${message}` }],
    };
  }
});

// ─── HTTP Server with SSE Transport ───────────────────────────────────────

// Track active SSE transports by their session ID so POST /message can route correctly
const activeTransports = new Map<string, SSEServerTransport>();

function setCorsHeaders(res: ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url ?? "/", `http://localhost:${config.MCP_PORT}`);

  // GET /sse — establish SSE connection
  if (req.method === "GET" && url.pathname === "/sse") {
    const transport = new SSEServerTransport("/message", res);
    activeTransports.set(transport.sessionId, transport);

    transport.onclose = () => {
      activeTransports.delete(transport.sessionId);
    };

    await mcpServer.connect(transport);
    return;
  }

  // POST /message?sessionId=... — client sends JSON-RPC messages
  if (req.method === "POST" && url.pathname === "/message") {
    const sessionId = url.searchParams.get("sessionId");
    if (!sessionId) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing sessionId query parameter" }));
      return;
    }

    const transport = activeTransports.get(sessionId);
    if (!transport) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: `No active SSE session for sessionId: ${sessionId}` }));
      return;
    }

    await transport.handlePostMessage(req, res);
    return;
  }

  // GET / — health check
  if (req.method === "GET" && url.pathname === "/") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        name: "flowstate-mcp-agents",
        version: "1.0.0",
        status: "running",
        model: config.NVIDIA_MODEL,
        tools: MCP_TOOLS.map((t) => t.name),
        active_sse_connections: activeTransports.size,
        active_agent_sessions: sessionManager.activeCount,
      }),
    );
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

// ─── Start ─────────────────────────────────────────────────────────────────

httpServer.listen(config.MCP_PORT, () => {
  console.log(`[flowstate-mcp] Server running on http://localhost:${config.MCP_PORT}`);
  console.log(`[flowstate-mcp] SSE endpoint:    GET  http://localhost:${config.MCP_PORT}/sse`);
  console.log(`[flowstate-mcp] Message endpoint: POST http://localhost:${config.MCP_PORT}/message`);
  console.log(`[flowstate-mcp] Health check:    GET  http://localhost:${config.MCP_PORT}/`);
  console.log(`[flowstate-mcp] Model: ${config.NVIDIA_MODEL}`);
  console.log(`[flowstate-mcp] Tools: ${MCP_TOOLS.map((t) => t.name).join(", ")}`);
});

// ─── Graceful Shutdown ─────────────────────────────────────────────────────

process.on("SIGINT", () => {
  console.log("\n[flowstate-mcp] Shutting down...");
  sessionManager.destroy();
  httpServer.close(() => process.exit(0));
});

process.on("SIGTERM", () => {
  sessionManager.destroy();
  httpServer.close(() => process.exit(0));
});
