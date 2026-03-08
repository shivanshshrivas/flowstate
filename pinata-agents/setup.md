Here's what you need to set up — tailored to your FlowState project:  
 --- Setting Up FlowState Agents on Pinata  
 Prerequisites - Paid Pinata plan (free tier doesn't support agents) - An OpenRouter API key (you're already using nvidia/nemotron-3-nano-30b-a3b) --- Step 1: Add Secrets to the Vault Go to https://agents.pinata.cloud → Secrets Vault and add these: ┌────────────────────┬──────────────────────────────────────────────────┐ │ Secret Name │ Value │ ├────────────────────┼──────────────────────────────────────────────────┤ │ OPENROUTER*API_KEY │ Your OpenRouter key │  
 ├────────────────────┼──────────────────────────────────────────────────┤
│ FLOWSTATE_API_KEY │ Your backend's project API key (fs_live_key*...) │
├────────────────────┼──────────────────────────────────────────────────┤
│ FLOWSTATE_API_URL │ Your backend URL (e.g. https://api.yourapp.com) │
└────────────────────┴──────────────────────────────────────────────────┘

Important: You can't view secrets after saving — store them elsewhere too.

---

Step 2: Upload Your Skills to IPFS

Each skill folder (skills/buyer/order-status/, etc.) needs to be uploaded to Pinata IPFS. You'll get a CID per
skill that you reference when attaching to an agent.

For each of the 15 skills: upload the index.js + SKILL.md + metadata.json as a folder pin.

---

Step 3: Create 3 Agents

Repeat this for BuyerAgent, SellerAgent, and AdminAgent:

Step 3a — Identity:

- Name: BuyerAgent / SellerAgent / AdminAgent
- Paste the system prompt from the corresponding pinata-agents/agents/\*.md file (the Personality / System  
  Prompt block — including the new CRITICAL SECURITY RULES)

Step 3b — Workspace:

- Select: Pinata Optimized Agent

Step 3c — Connect:

- LLM Provider: OpenRouter
- Model: nvidia/nemotron-3-nano-30b-a3b
- API Key Secret: OPENROUTER_API_KEY
- Attach skills (by IPFS CID):
  - Buyer → order-status, track-shipment, file-dispute, get-receipt, list-my-orders
  - Seller → list-orders, get-metrics, confirm-label, respond-dispute, get-payouts
  - Admin → get-analytics, list-sellers, flagged-sellers, webhook-logs, gas-report

Step 3d — Deploy: Click Deploy, wait for the container to start.

---

Step 4: Copy Agent URLs → Set Backend .env

After each agent deploys, copy its gateway chat URL from the dashboard and add to your backend .env:

PINATA_BUYER_AGENT_URL=https://agents.pinata.cloud/gateway/<buyer-agent-id>/chat
PINATA_BUYER_AGENT_TOKEN=<buyer-agent-token>

PINATA_SELLER_AGENT_URL=https://agents.pinata.cloud/gateway/<seller-agent-id>/chat
PINATA_SELLER_AGENT_TOKEN=<seller-agent-token>

PINATA_ADMIN_AGENT_URL=https://agents.pinata.cloud/gateway/<admin-agent-id>/chat
PINATA_ADMIN_AGENT_TOKEN=<admin-agent-token>

The token is the auth token for the WebSocket connection (from the agent's settings page).

---

Step 5: Verify

Use pinata-agents/ws-test.js to manually send a test chat and confirm:

- The sessionKey in the WebSocket frame is user:<userId> (not agent:main:main)
- The message arrives with [SYSTEM_CONTEXT: ...] prefix
- Skill API calls include X-Caller-User-Id in the request headers (check backend logs)

---

Key Things Specific to Your Setup

1. Each skill needs FLOWSTATE_API_KEY and FLOWSTATE_API_URL in the vault — the skills read these from
   process.env at runtime. Make sure those secret names match exactly.
2. 3 separate Pinata accounts — each agent shares conversation history per sessionKey. With our fix (per-user  
   session keys), all 3 agents can safely be on the same or separate accounts.
3. The CID.txt file in your pinata-agents/ folder likely has CIDs from previous uploads — you may be able to  
   reuse those if the skills haven't changed (they have changed now, so re-upload all 15).
