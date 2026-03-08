# Plan: Pinata OpenClaw Agents with OpenRouter

## Context

The architecture specifies 3 AI agents (Buyer, Seller, Admin) hosted on Pinata's OpenClaw platform (agents.pinata.cloud). Currently, these agents are implemented as a self-hosted MCP server in `mcp-agents/` using LangChain + NVIDIA Nemotron direct API. The goal is to create the OpenClaw skill packages so these agents can be deployed on Pinata with OpenRouter as the LLM provider, as originally designed.

**Model**: `nvidia/nemotron-3-nano-30b-a3b` via OpenRouter (the Nemotron Ultra 253B from mcp-agents is not on OpenRouter; this 30B MoE model is purpose-built for agentic AI with 256K context).

**Backend status**: Already wired up — `backend/src/routes/agents.routes.ts` has `POST /agents/chat`, and `backend/src/services/agent.service.ts` routes to `PINATA_BUYER_AGENT_URL`, `PINATA_SELLER_AGENT_URL`, `PINATA_ADMIN_AGENT_URL` env vars. Just needs the URLs once agents are deployed.

**mcp-agents/**: Kept as-is for local dev/testing fallback.

---

## What We're Creating

A new `pinata-agents/` directory with 15 OpenClaw skill packages (one per tool) organized by agent, plus agent personality configs and a setup guide.

### Directory Structure

```
pinata-agents/
├── README.md                          # Setup guide for Pinata dashboard
├── agents/
│   ├── buyer-agent.md                 # Personality + system prompt config
│   ├── seller-agent.md                # Personality + system prompt config
│   └── admin-agent.md                 # Personality + system prompt config
├── skills/
│   ├── buyer/
│   │   ├── order-status/
│   │   │   ├── SKILL.md               # YAML frontmatter + description
│   │   │   └── index.js               # HTTP call to Flow State API
│   │   ├── track-shipment/
│   │   │   ├── SKILL.md
│   │   │   └── index.js
│   │   ├── file-dispute/
│   │   │   ├── SKILL.md
│   │   │   └── index.js
│   │   ├── get-receipt/
│   │   │   ├── SKILL.md
│   │   │   └── index.js
│   │   └── list-my-orders/
│   │       ├── SKILL.md
│   │       └── index.js
│   ├── seller/
│   │   ├── list-orders/
│   │   │   ├── SKILL.md
│   │   │   └── index.js
│   │   ├── get-metrics/
│   │   │   ├── SKILL.md
│   │   │   └── index.js
│   │   ├── confirm-label/
│   │   │   ├── SKILL.md
│   │   │   └── index.js
│   │   ├── respond-dispute/
│   │   │   ├── SKILL.md
│   │   │   └── index.js
│   │   └── get-payouts/
│   │       ├── SKILL.md
│   │       └── index.js
│   └── admin/
│       ├── get-analytics/
│       │   ├── SKILL.md
│       │   └── index.js
│       ├── list-sellers/
│       │   ├── SKILL.md
│       │   └── index.js
│       ├── flagged-sellers/
│       │   ├── SKILL.md
│       │   └── index.js
│       ├── webhook-logs/
│       │   ├── SKILL.md
│       │   └── index.js
│       └── gas-report/
│           ├── SKILL.md
│           └── index.js
```

**Total: 30 files (15 SKILL.md + 15 index.js) + 3 agent configs + 1 README**

---

## Skill Format

Each `SKILL.md` follows OpenClaw's format:

```yaml
---
name: order-status
description: Get the full status, financials, and shipping info of a buyer's order
env:
  - FLOWSTATE_API_KEY
  - FLOWSTATE_API_URL
---

## Usage
Call this skill with an `order_id` to get the current state of a buyer's order.

## Parameters
- `order_id` (string, required): The order ID to look up

## Returns
Order state, items, totals, escrow details, shipping info, and state history.
```

Each `index.js` makes an HTTP call to the Flow State backend API:

```javascript
const API_URL = process.env.FLOWSTATE_API_URL || 'https://api.flowstate.xyz';
const API_KEY = process.env.FLOWSTATE_API_KEY;

async function run({ order_id }) {
  const res = await fetch(`${API_URL}/api/v1/orders/${order_id}`, {
    headers: { 'Authorization': `Bearer ${API_KEY}` },
  });
  if (!res.ok) throw new Error(`API returned ${res.status}`);
  return await res.json();
}
```

---

## Skill Mapping (mcp-agents tool → OpenClaw skill)

### Buyer Skills
| mcp-agents tool | OpenClaw skill | API endpoint |
|---|---|---|
| `order_status` | `buyer/order-status` | `GET /api/v1/orders/:id` |
| `track_shipment` | `buyer/track-shipment` | `GET /api/v1/shipping/track/:orderId` |
| `file_dispute` | `buyer/file-dispute` | `POST /api/v1/disputes/create` |
| `get_receipt` | `buyer/get-receipt` | `GET /api/v1/orders/:id` (extract invoice) |
| `list_my_orders` | `buyer/list-my-orders` | `GET /api/v1/orders?buyer=<wallet>` |

### Seller Skills
| mcp-agents tool | OpenClaw skill | API endpoint |
|---|---|---|
| `list_orders` | `seller/list-orders` | `GET /api/v1/sellers/:id/orders` |
| `get_metrics` | `seller/get-metrics` | `GET /api/v1/sellers/:id/metrics` |
| `confirm_label` | `seller/confirm-label` | `POST /api/v1/orders/:id/confirm-label-printed` |
| `respond_dispute` | `seller/respond-dispute` | `POST /api/v1/disputes/:id/respond` |
| `get_payouts` | `seller/get-payouts` | `GET /api/v1/sellers/:id/payouts` |

### Admin Skills
| mcp-agents tool | OpenClaw skill | API endpoint |
|---|---|---|
| `get_analytics` | `admin/get-analytics` | `GET /api/v1/platform/:projectId/analytics` |
| `list_sellers` | `admin/list-sellers` | `GET /api/v1/platform/:projectId/sellers` |
| `flagged_sellers` | `admin/flagged-sellers` | `GET /api/v1/platform/:projectId/sellers?flagged=true` |
| `webhook_logs` | `admin/webhook-logs` | `GET /api/v1/webhooks/logs` |
| `gas_report` | `admin/gas-report` | `GET /api/v1/platform/:projectId/gas-costs` |

---

## Agent Configs (for Pinata Dashboard)

Each agent config file documents what to enter in the Pinata dashboard:

| Agent | Personality | Provider | Model |
|---|---|---|---|
| BuyerAgent | Helpful shopping assistant | OpenRouter | `nvidia/nemotron-3-nano-30b-a3b` |
| SellerAgent | Data-driven operations assistant | OpenRouter | `nvidia/nemotron-3-nano-30b-a3b` |
| AdminAgent | Platform operations analyst | OpenRouter | `nvidia/nemotron-3-nano-30b-a3b` |

### Pinata Secrets Vault (per agent)
- `OPENROUTER_API_KEY` — OpenRouter API key
- `FLOWSTATE_API_KEY` — Flow State backend API key
- `FLOWSTATE_API_URL` — Backend URL (e.g., `https://api.flowstate.xyz`)

---

## README.md (Setup Guide)

Step-by-step guide covering:
1. Prerequisites (Pinata paid plan, OpenRouter API key, Flow State API key)
2. Uploading skills to Pinata (pin each skill folder to IPFS)
3. Creating each agent on agents.pinata.cloud (4-step wizard)
4. Configuring secrets in the Pinata Secrets Vault
5. Getting the agent chat URLs
6. Setting `PINATA_BUYER_AGENT_URL`, `PINATA_SELLER_AGENT_URL`, `PINATA_ADMIN_AGENT_URL` in the backend `.env`
7. Testing the agents via the Pinata chat interface

---

## Implementation Order

1. Create `pinata-agents/` directory structure
2. Write the 3 agent personality configs (`agents/*.md`)
3. Write all 15 SKILL.md files with proper YAML frontmatter
4. Write all 15 index.js skill scripts (HTTP calls to Flow State API)
5. Write the README.md setup guide
6. Update `architecture.md` Sub-Component 6 to reflect the model change to `nvidia/nemotron-3-nano-30b-a3b`

---

## Key Differences from mcp-agents

| Aspect | mcp-agents (current) | pinata-agents (new) |
|---|---|---|
| Runtime | Self-hosted Node.js MCP server | Pinata-hosted OpenClaw containers |
| LLM | NVIDIA Nemotron Ultra 253B (direct API) | Nemotron 3 Nano 30B via OpenRouter |
| Tool format | LangChain DynamicStructuredTool | SKILL.md + index.js scripts |
| Session mgmt | Custom SessionManager (in-memory) | OpenClaw native sessions |
| Data source | Mock data (in-memory) | Flow State backend API (live) |
| Hosting cost | Self-hosted (your infra) | Pinata-hosted (their infra) |

---

## Files to Reference

- `mcp-agents/src/tools/buyer-tools.ts` — tool logic to port to skills
- `mcp-agents/src/tools/seller-tools.ts` — tool logic to port to skills
- `mcp-agents/src/tools/admin-tools.ts` — tool logic to port to skills
- `mcp-agents/src/agents/buyer-agent.ts` — system prompt to reuse
- `mcp-agents/src/agents/seller-agent.ts` — system prompt to reuse
- `mcp-agents/src/agents/admin-agent.ts` — system prompt to reuse
- `backend/src/routes/agents.routes.ts` — already has POST /agents/chat
- `backend/src/services/agent.service.ts` — already routes to PINATA_*_AGENT_URL
- `backend/src/config/env.ts` — already has PINATA_*_AGENT_URL env vars
- `.claude/architecture.md` — update Sub-Component 6

---

## Verification

1. **Skill structure**: Each skill folder has valid SKILL.md with YAML frontmatter + index.js
2. **API calls**: Each index.js correctly targets the right Flow State API endpoint
3. **Agent configs**: System prompts match the mcp-agents personality prompts
4. **Dashboard guide**: README covers the full Pinata agent creation flow
5. **Backend wiring**: Confirm `PINATA_*_AGENT_URL` env vars in `backend/src/config/env.ts` are ready to accept the deployed agent URLs
