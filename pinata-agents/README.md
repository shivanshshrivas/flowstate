# Flow State — Pinata OpenClaw Agents

Three AI agents hosted on [agents.pinata.cloud](https://agents.pinata.cloud) that power the buyer, seller, and admin chat interfaces in the `@flowstate/gateway` package.

| Agent | Role | Skills |
|---|---|---|
| BuyerAgent | Helpful shopping assistant | order-status, track-shipment, file-dispute, get-receipt, list-my-orders |
| SellerAgent | Data-driven operations assistant | list-orders, get-metrics, confirm-label, respond-dispute, get-payouts |
| AdminAgent | Platform operations analyst | get-analytics, list-sellers, flagged-sellers, webhook-logs, gas-report |

**Model:** `nvidia/nemotron-3-nano-30b-a3b` via OpenRouter (256K context, purpose-built for agentic AI)

---

## How It All Connects

The Pinata agents are never called directly from the frontend. The chat flow is:

```
React component (BuyerChat.tsx / SellerDashboard.tsx / AdminDashboard.tsx)
    ↓  POST /api/v1/agents/chat  { role, user_id, message }
Flow State Backend (backend/src/services/agent.service.ts)
    ↓  POST to PINATA_{ROLE}_AGENT_URL
Pinata OpenClaw container
    ↓  Nemotron via OpenRouter + skill scripts → Flow State API
    ↑  { response, suggested_actions }
Flow State Backend
    ↑  { success: true, data: { response, role, suggested_actions } }
React component renders the response
```

The backend already has this wired — `backend/src/services/agent.service.ts` reads `PINATA_BUYER_AGENT_URL`, `PINATA_SELLER_AGENT_URL`, and `PINATA_ADMIN_AGENT_URL` from env vars and proxies chat requests to Pinata.

---

## Prerequisites

- [ ] Pinata paid plan (required for Agents)
- [ ] OpenRouter account and API key — [openrouter.ai](https://openrouter.ai)
- [ ] Flow State backend running (local `http://localhost:3000` for dev, or deployed URL)
- [ ] Flow State API key (from `POST /api/v1/auth/projects/create` on your backend)

---

## Step 1 — Add Secrets in Pinata

Before creating agents, add these to your Pinata Secrets Vault at [app.pinata.cloud](https://app.pinata.cloud) → **Secrets**:

| Secret Key | Value |
|---|---|
| `OPENROUTER_API_KEY` | Your OpenRouter API key |
| `FLOWSTATE_API_KEY` | Your Flow State backend API key |
| `FLOWSTATE_API_URL` | `http://localhost:3000` (dev) or your deployed backend URL |

---

## Step 2 — Upload Skills to Pinata IPFS

Each skill folder must be pinned to IPFS so OpenClaw can access it. Upload all 15 skill folders.

**Via Pinata web app:**
1. Go to [app.pinata.cloud](https://app.pinata.cloud) → **Files**
2. Click **Upload** → **Folder**
3. Upload each skill folder (e.g. `skills/buyer/order-status/`) — select the folder itself, not its contents
4. Note the CID for each skill

**Folder structure per skill:**
```
order-status/
├── SKILL.md    ← OpenClaw reads this for the skill's name, description, and env vars
└── index.js    ← The script OpenClaw executes when the LLM calls this tool
```

---

## Step 3 — Create BuyerAgent

1. Go to [agents.pinata.cloud](https://agents.pinata.cloud) → **Create Agent**

2. **Identity**
   - Name: `BuyerAgent`
   - Paste the system prompt from `agents/buyer-agent.md`

3. **Agent Workspace**
   - Select: **Pinata Optimized Agent**

4. **Connect**
   - LLM Provider: **OpenRouter**
   - Model: `nvidia/nemotron-3-nano-30b-a3b`
   - API Key: select `OPENROUTER_API_KEY` from Secrets Vault
   - Attach skills by CID (the 5 buyer skill folders you uploaded in Step 2):
     - `buyer/order-status`
     - `buyer/track-shipment`
     - `buyer/file-dispute`
     - `buyer/get-receipt`
     - `buyer/list-my-orders`

5. **Deploy** — click Deploy and wait for the container to start

6. Copy the **Agent ID** and **gateway chat URL** from the dashboard

---

## Step 4 — Create SellerAgent

Same process as Step 3 but:
- Name: `SellerAgent`
- System prompt from `agents/seller-agent.md`
- Attach skills: `seller/list-orders`, `seller/get-metrics`, `seller/confirm-label`, `seller/respond-dispute`, `seller/get-payouts`

---

## Step 5 — Create AdminAgent

Same process but:
- Name: `AdminAgent`
- System prompt from `agents/admin-agent.md`
- Attach skills: `admin/get-analytics`, `admin/list-sellers`, `admin/flagged-sellers`, `admin/webhook-logs`, `admin/gas-report`

---

## Step 6 — Configure Backend

Add the three agent gateway URLs to `backend/.env`:

```env
PINATA_BUYER_AGENT_URL=https://agents.pinata.cloud/gateway/<buyer-agent-id>/chat
PINATA_SELLER_AGENT_URL=https://agents.pinata.cloud/gateway/<seller-agent-id>/chat
PINATA_ADMIN_AGENT_URL=https://agents.pinata.cloud/gateway/<admin-agent-id>/chat
```

The backend `agent.service.ts` will automatically start routing to these agents — no code changes needed.

---

## Step 7 — Test

```bash
# Test the buyer agent
curl -X POST http://localhost:3000/api/v1/agents/chat \
  -H "Authorization: Bearer <your-flowstate-api-key>" \
  -H "Content-Type: application/json" \
  -d '{"role":"buyer","user_id":"0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266","message":"Where is my order?"}'

# Test the seller agent
curl -X POST http://localhost:3000/api/v1/agents/chat \
  -H "Authorization: Bearer <your-flowstate-api-key>" \
  -H "Content-Type: application/json" \
  -d '{"role":"seller","user_id":"seller-001","message":"What orders need my attention?"}'

# Test the admin agent
curl -X POST http://localhost:3000/api/v1/agents/chat \
  -H "Authorization: Bearer <your-flowstate-api-key>" \
  -H "Content-Type: application/json" \
  -d '{"role":"admin","user_id":"admin","message":"How is the platform doing?"}'
```

---

## Directory Structure

```
pinata-agents/
├── README.md
├── agents/
│   ├── buyer-agent.md       ← System prompt + dashboard config for BuyerAgent
│   ├── seller-agent.md      ← System prompt + dashboard config for SellerAgent
│   └── admin-agent.md       ← System prompt + dashboard config for AdminAgent
└── skills/
    ├── buyer/
    │   ├── order-status/    ← GET /api/v1/orders/:id
    │   ├── track-shipment/  ← GET /api/v1/shipping/track/:orderId
    │   ├── file-dispute/    ← POST /api/v1/disputes/create
    │   ├── get-receipt/     ← GET /api/v1/orders/:id (extracts invoice fields)
    │   └── list-my-orders/  ← GET /api/v1/orders?buyer=<wallet>
    ├── seller/
    │   ├── list-orders/     ← GET /api/v1/sellers/:id/orders
    │   ├── get-metrics/     ← GET /api/v1/sellers/:id/metrics
    │   ├── confirm-label/   ← POST /api/v1/orders/:id/confirm-label-printed
    │   ├── respond-dispute/ ← POST /api/v1/disputes/:id/respond
    │   └── get-payouts/     ← GET /api/v1/sellers/:id/payouts
    └── admin/
        ├── get-analytics/   ← GET /api/v1/platform/:projectId/analytics
        ├── list-sellers/    ← GET /api/v1/platform/:projectId/sellers
        ├── flagged-sellers/ ← GET /api/v1/platform/:projectId/sellers?flagged=true
        ├── webhook-logs/    ← GET /api/v1/webhooks/logs
        └── gas-report/      ← GET /api/v1/platform/:projectId/gas-costs
```
