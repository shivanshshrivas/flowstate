# MCP Agents Implementation Plan

## Context

The Flow State architecture specifies 3 AI agents (Buyer, Seller, Admin) with 15 total tool-calling skills. The original design uses Pinata OpenClaw + OpenRouter, but we're replacing that with a standalone **MCP (Model Context Protocol) server** using **LangChain + NVIDIA Nemotron** (via `build.nvidia.com`). The MCP server will expose these agents as tools that can be called from any MCP client, with each agent capable of natural language understanding and tool calling.

**Location:** `flowstate/mcp-agents/` (new root-level folder)
**Transport:** SSE (HTTP)
**LLM:** NVIDIA Nemotron via `@langchain/nvidia` (ChatNVIDIA)
**Data:** Mock data directly (no dependency on running demo-store)

---

## What Already Exists vs What's New

### Exists in `demo-store/` (reference only — not imported):
| Asset | File | Reuse Strategy |
|-------|------|----------------|
| TypeScript types (Order, Seller, Product, etc.) | `src/lib/flowstate/types/index.ts` | Copy type definitions into mcp-agents (keep independent) |
| Mock data (10 products, 2 sellers, 2 orders, payouts, analytics, webhooks) | `src/lib/mock-data.ts` | Port data shapes + extend with more orders/disputes for agent testing |
| API stubs (POST /orders, GET /sellers, etc.) | `src/app/api/*/route.ts` | **Not reused** — these are Next.js route handlers, too basic for agent needs |
| Contract ABIs | `src/lib/flowstate/contracts/*.abi.ts` | Not needed for mock-data agents |

### Does NOT exist (all new):
- **No agent code** — no LangChain, no Nemotron, no tool definitions
- **No MCP server** — no `@modelcontextprotocol/sdk` setup
- **No session management** — no isolation, no history tracking
- **No agent-facing tools** — the 15 skills from architecture.md aren't built anywhere

**Conclusion: Everything in `mcp-agents/` is net-new.** We reference demo-store's types and mock data patterns but don't import from it.

---

## Phase 1: Project Scaffolding

### 1.1 Initialize the project
- Create `flowstate/mcp-agents/` directory
- `npm init` with TypeScript
- Install dependencies:
  - `@modelcontextprotocol/sdk` — MCP server SDK
  - `langchain` + `@langchain/nvidia` — LangChain with NVIDIA Nemotron
  - `@langchain/core` — core types and tool abstractions
  - `zod` — schema validation for tool parameters
  - `tsx` — TypeScript execution
  - `dotenv` — env var management

### 1.2 Project structure
```
mcp-agents/
├── package.json
├── tsconfig.json
├── .env.example          # NVIDIA_API_KEY
├── src/
│   ├── index.ts          # MCP server entry point (SSE transport)
│   ├── config.ts         # env vars, constants
│   ├── session/
│   │   └── session-manager.ts  # Per-user session isolation + TTL cleanup
│   ├── mock-data/
│   │   └── index.ts      # Mock products, orders, sellers, disputes, analytics
│   ├── agents/
│   │   ├── base-agent.ts # Shared agent creation logic (LangChain + Nemotron)
│   │   ├── buyer-agent.ts
│   │   ├── seller-agent.ts
│   │   └── admin-agent.ts
│   └── tools/
│       ├── buyer-tools.ts   # 5 buyer tools
│       ├── seller-tools.ts  # 5 seller tools
│       └── admin-tools.ts   # 5 admin tools
```

### Files to create: 12 files

---

## Phase 2: Mock Data Layer

### 2.1 Create `src/mock-data/index.ts`
Port relevant mock data from `demo-store/src/lib/mock-data.ts` — reuse the same types and data shapes:
- `MOCK_PRODUCTS` — product catalog
- `MOCK_ORDERS` — orders in various states (INITIATED through FINALIZED + DISPUTED)
- `MOCK_SELLERS` — seller profiles with metrics
- `MOCK_SELLER_METRICS` — per-seller performance data
- `MOCK_PAYOUTS` — payout history records
- `MOCK_DISPUTES` — dispute records
- `MOCK_ANALYTICS` — platform-wide analytics
- `MOCK_WEBHOOK_EVENTS` — webhook log entries

Use inline TypeScript types (don't import from demo-store to keep the project independent).

---

## Phase 3: LangChain Tool Definitions

Each tool is a LangChain `DynamicStructuredTool` with Zod schemas for input validation. Tools query mock data and return structured responses.

### 3.1 Buyer Tools (`src/tools/buyer-tools.ts`) — 5 tools

| Tool | Input Schema | Returns | Source (architecture.md) |
|------|-------------|---------|--------------------------|
| `order_status` | `{ order_id: string }` | Full order state, financials, shipping info | GET /api/v1/orders/:id |
| `track_shipment` | `{ order_id: string }` | Carrier, location, ETA, tracking history | GET /api/v1/shipping/track/:orderId |
| `file_dispute` | `{ order_id: string, reason: string, description: string }` | Dispute ID, frozen amount, deadline | POST /api/v1/disputes/create |
| `get_receipt` | `{ order_id: string }` | Invoice/receipt details, IPFS URL | GET /api/v1/orders/:id → invoice |
| `list_my_orders` | `{ buyer_wallet: string }` | Paginated order list with status | GET /api/v1/orders?buyer=wallet |

### 3.2 Seller Tools (`src/tools/seller-tools.ts`) — 5 tools

| Tool | Input Schema | Returns |
|------|-------------|---------|
| `list_orders` | `{ seller_id: string, status?: string }` | Orders needing action |
| `get_metrics` | `{ seller_id: string, period?: string }` | Order counts, revenue, dispute rate, reputation |
| `confirm_label` | `{ order_id: string, seller_id: string }` | State transition confirmation, payout released |
| `respond_dispute` | `{ dispute_id: string, action: "accept" \| "contest", evidence?: string }` | Updated dispute status |
| `get_payouts` | `{ seller_id: string }` | Payout history with amounts and tx hashes |

### 3.3 Admin Tools (`src/tools/admin-tools.ts`) — 5 tools

| Tool | Input Schema | Returns |
|------|-------------|---------|
| `get_analytics` | `{ period?: string }` | Order volume, revenue, dispute rate, gas costs |
| `list_sellers` | `{ status?: string }` | All sellers with volume and reputation |
| `flagged_sellers` | `{ threshold?: number }` | Sellers with dispute rate above threshold |
| `webhook_logs` | `{ status?: string, limit?: number }` | Recent webhook deliveries |
| `gas_report` | `{}` | Total gas spent, avg per transition |

---

## Phase 3.5: Session Isolation & Context Guardrails

This phase addresses the critical problem: **two users calling the same agent must never see each other's data or conversation context.**

### 3.5.1 Session Manager (`src/session/session-manager.ts`)

A `SessionManager` class that maintains isolated per-session state:

```typescript
interface Session {
  id: string;                          // unique session ID (UUID)
  agentType: "buyer" | "seller" | "admin";
  userId: string;                      // buyer_wallet or seller_id
  chatHistory: BaseMessage[];          // LangChain message history (isolated per session)
  createdAt: number;
  lastActiveAt: number;
}
```

**Key design decisions:**
- **In-memory `Map<sessionId, Session>`** — each SSE connection gets a unique session
- **Chat history is per-session** — User A's conversation with BuyerAgent is completely separate from User B's
- **TTL auto-cleanup** — sessions expire after 30 minutes of inactivity, cleaned up by a `setInterval` sweep every 5 minutes. Prevents memory leaks.
- **Max sessions cap** — limit to 100 concurrent sessions. Returns error if exceeded (prevents OOM).
- **No shared mutable state** — mock data is read-only; tools that "mutate" (e.g. `file_dispute`, `confirm_label`) return simulated responses without modifying global mock data

### 3.5.2 Context Guardrails

**Data scoping — tools enforce ownership:**
- Buyer tools always filter by `buyer_wallet` from the session context — a buyer can never query another buyer's orders
- Seller tools always filter by `seller_id` from session context — a seller can never see another seller's metrics/orders
- Admin tools have no user-scoping (admins see everything) but are still session-isolated for chat history

**Implementation:** Each tool receives a `sessionContext` object injected by the agent runner, containing the `userId` and `agentType`. Tools use this to filter data, not user-provided IDs.

```
MCP tool call → extract session_id → look up Session → inject sessionContext into tools → agent runs with scoped tools
```

**Prompt-level guardrails in system prompts:**
- Each agent's system prompt includes: "You MUST only access data belonging to the current user. Never reveal information about other users, orders, or sellers that don't belong to this session."
- Agent system prompts include the user's identity so the LLM knows who it's serving

**No cross-session leakage vectors:**
- LangChain agent instances are created per-invocation (stateless) — the chat history is loaded from the session store, not from a persistent agent object
- Tool results are scoped per-call, never cached across sessions
- Error messages never leak other users' data

### 3.5.3 MCP Tool Schema Update

The MCP tools now include a `session_id` parameter:

| MCP Tool Name | Input Schema |
|---------------|-------------|
| `buyer_agent_chat` | `{ message: string, session_id?: string, buyer_wallet?: string }` |
| `seller_agent_chat` | `{ message: string, session_id?: string, seller_id?: string }` |
| `admin_agent_chat` | `{ message: string, session_id?: string }` |

- If `session_id` is provided → resume existing session (with history)
- If `session_id` is omitted → create new session, return the `session_id` in the response
- If `session_id` is invalid/expired → create new session, inform user that previous session expired

---

## Phase 4: Agent Construction

### 4.1 Base Agent (`src/agents/base-agent.ts`)
- Create a factory function `createAgent(config)` that:
  - Initializes `ChatNVIDIA` with model `nvidia/nemotron-ultra-253b` (or `meta/llama-3.1-70b-instruct` as fallback)
  - Binds LangChain tools via `.bindTools()`
  - Creates a ReAct-style agent loop using `AgentExecutor` or manual tool-calling loop
  - Accepts: system prompt, tools array, model config, **sessionContext**
  - Loads chat history from session store before each invocation
  - Saves updated chat history back to session store after each invocation
  - Returns: an async function `(userMessage: string, session: Session) => Promise<{ response: string, session_id: string }>`

### 4.2 Buyer Agent (`src/agents/buyer-agent.ts`)
- System prompt: "You are a helpful shopping assistant for the Flow State e-commerce platform. You help buyers check order status, track shipments, file disputes, and retrieve receipts. Always be friendly and provide clear, actionable information."
- Tools: all 5 buyer tools
- Personality: Helpful, empathetic, guides through dispute process

### 4.3 Seller Agent (`src/agents/seller-agent.ts`)
- System prompt: "You are a data-driven operations assistant for sellers on the Flow State platform. You help sellers manage orders, track metrics, confirm shipments, handle disputes, and monitor payouts. Provide concise, business-focused insights."
- Tools: all 5 seller tools
- Personality: Professional, data-oriented, proactive about actionable items

### 4.4 Admin Agent (`src/agents/admin-agent.ts`)
- System prompt: "You are a platform operations analyst for the Flow State e-commerce platform. You help administrators monitor platform health, identify problematic sellers, review webhook logs, and analyze gas costs. Provide analytical insights with specific numbers."
- Tools: all 5 admin tools
- Personality: Analytical, concise, flags anomalies

---

## Phase 5: MCP Server

### 5.1 Entry point (`src/index.ts`)
- Create MCP server using `@modelcontextprotocol/sdk`
- SSE transport on configurable port (default: 3001)
- Initialize `SessionManager` singleton at startup
- Register 3 MCP tools:

| MCP Tool Name | Description | Input Schema |
|---------------|-------------|-------------|
| `buyer_agent_chat` | Chat with the buyer support agent | `{ message: string, session_id?: string, buyer_wallet?: string }` |
| `seller_agent_chat` | Chat with the seller operations agent | `{ message: string, session_id?: string, seller_id?: string }` |
| `admin_agent_chat` | Chat with the platform admin agent | `{ message: string, session_id?: string }` |

- Each MCP tool invocation:
  1. Receives the natural language message + optional `session_id`
  2. Resolves or creates session via `SessionManager`
  3. Injects `sessionContext` (userId, agentType) into tools for data scoping
  4. Loads chat history from session, appends user message
  5. Runs the appropriate LangChain agent with scoped tools + history
  6. Saves updated history back to session
  7. Returns `{ response: string, session_id: string }` — client stores `session_id` for continuity

### 5.2 Config (`src/config.ts`)
- `NVIDIA_API_KEY` — required
- `MCP_PORT` — default 3001
- `NVIDIA_MODEL` — default `nvidia/nemotron-ultra-253b`

### 5.3 `.env.example`
```
NVIDIA_API_KEY=nvapi-xxxxx
MCP_PORT=3001
NVIDIA_MODEL=nvidia/nemotron-ultra-253b
```

---

## Phase 6: Testing & Verification

### 6.1 Manual testing
- Start the MCP server: `npx tsx src/index.ts`
- Test with curl against SSE endpoint
- Verify each agent responds to natural language and calls appropriate tools

### 6.2 Test scenarios
**Buyer agent:**
- "Where is my order ord-001?" → should call `order_status`
- "Track my package for order ord-002" → should call `track_shipment`
- "I want to file a dispute, item was damaged" → should call `file_dispute`
- "Show my receipt for order ord-001" → should call `get_receipt`
- "Show all my orders" → should call `list_my_orders`

**Seller agent:**
- "What orders need my attention?" → should call `list_orders`
- "What's my dispute rate this month?" → should call `get_metrics`
- "Confirm label printed for order ord-003" → should call `confirm_label`
- "Show my earnings" → should call `get_payouts`

**Admin agent:**
- "How is the platform doing?" → should call `get_analytics`
- "Show me problem sellers" → should call `flagged_sellers`
- "What are our gas costs?" → should call `gas_report`

### 6.3 MCP client integration test
- Add MCP server config to Claude Desktop or Cursor to verify it connects via SSE

---

## Implementation Order

1. **Phase 1** — Scaffold project, install deps, create tsconfig
2. **Phase 2** — Mock data layer
3. **Phase 3** — All 15 LangChain tools (buyer, seller, admin)
4. **Phase 3.5** — Session manager + context guardrails
5. **Phase 4** — Base agent factory (with session-aware invocation) + 3 agent instances
6. **Phase 5** — MCP server with SSE transport + 3 registered tools + session lifecycle
7. **Phase 6** — Test end-to-end (including multi-session isolation verification)

---

## Key Files Modified/Created

All new files in `flowstate/mcp-agents/`:
- `package.json` — project config + dependencies
- `tsconfig.json` — TypeScript config
- `.env.example` — environment template
- `src/index.ts` — MCP server entry point (with session lifecycle)
- `src/config.ts` — configuration
- `src/session/session-manager.ts` — session isolation + TTL cleanup + guardrails
- `src/mock-data/index.ts` — all mock data (read-only, never mutated)
- `src/tools/buyer-tools.ts` — 5 buyer tools (scoped by buyer_wallet from session)
- `src/tools/seller-tools.ts` — 5 seller tools (scoped by seller_id from session)
- `src/tools/admin-tools.ts` — 5 admin tools (unscoped, session-isolated history only)
- `src/agents/base-agent.ts` — agent factory (session-aware, loads/saves history)
- `src/agents/buyer-agent.ts` — buyer agent
- `src/agents/seller-agent.ts` — seller agent
- `src/agents/admin-agent.ts` — admin agent

**No existing files are modified.** This is a completely new, independent module.

---

## Session Isolation Summary

| Concern | Solution |
|---------|----------|
| Chat history crossover | Per-session `Map` — each session has its own `BaseMessage[]` |
| Data access crossover | Tools receive `sessionContext` with userId — filter all queries by owner |
| Concurrent sessions on same agent | Each invocation is stateless (agent created per-call), state lives in session store |
| Memory exhaustion | 30-min TTL + 100 max sessions cap + periodic cleanup sweep |
| Tool mutation side-effects | Mock data is read-only; "write" tools return simulated success without modifying global state |
| Prompt injection across sessions | System prompt hardcodes user identity; tools enforce ownership at data layer |
