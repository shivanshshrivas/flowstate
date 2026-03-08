# Flow State — Project Context

## Overview

Flow State is a blockchain-based payment gateway with escrow, shipping, dispute resolution, and AI agent support. It is **not** a formal monorepo — each directory has its own independent `package.json`.

---

## Repository Layout

```
flowstate/
├── backend/            # Fastify backend API (flowstate-backend)
│   └── gateway/        # @flowstate/gateway npm package (React + server SDK)
├── demo-store/         # Next.js 16 demo e-commerce storefront
├── packages/contracts/ # Solidity smart contracts (Hardhat)
├── mcp-agents/         # MCP server with Buyer/Seller/Admin AI agents
├── pinata/             # Pinata IPFS sandbox (Express + Multer)
├── pinata-agents/      # AI agent test harness
├── pinata-mcp/         # MCP-based chat client for Pinata
├── shippo/             # Shippo shipping API integration
├── docs/               # project-breakdown.md
└── docs-site/          # Incomplete docs site scaffold
```

---

## System Architecture

The system has three tiers:

1. **Developer's App** (demo-store) — Next.js frontend that imports `@flowstate/gateway` for checkout, tracking, dashboards, and chat widgets. Server-side uses `FlowStateServer` for webhook verification.

2. **Flow State Backend API** (`api.flowstate.xyz`) — Hosted Fastify service that orchestrates orders, shipping, disputes, sellers, agents, and webhooks. Connects to PostgreSQL (Neon), Redis (Upstash/BullMQ), and dispatches webhooks to developers.

3. **External Services** — XRPL EVM Sidechain (smart contracts), Shippo (shipping), Pinata (IPFS + AI agents via OpenClaw).

### Connection pattern
```
Developer App (Next.js)
  ├── Client SDK components ──HTTPS+WS──► Backend API
  └── FlowStateServer ◄──Webhook POST── Backend API
                                            │
                          ┌─────────────────┼─────────────────┐
                          ▼                 ▼                 ▼
                   XRPL EVM Chain      Shippo API       Pinata (IPFS + Agents)
```

---

## Tech Stack by Package

### demo-store (Next.js Frontend)
- Next.js 16 (App Router), React 19, TypeScript
- Tailwind CSS 4, Radix UI, shadcn/ui
- RainbowKit + wagmi + viem (wallet connection to XRPL EVM testnet)
- Zustand (state), Recharts (charts), Supabase (DB)
- Depends on `@flowstate/gateway` via `file:../backend/gateway/flowstate-gateway-0.0.1.tgz`

### backend (Fastify API)
- Fastify, TypeScript, Node.js 20+
- PostgreSQL via `postgres` (Neon), Drizzle ORM
- Redis (Upstash), BullMQ (job queue)
- WebSocket (`ws`) for real-time Event Bus
- ethers.js v6 (blockchain), Shippo Node SDK, Pinata SDK
- API key auth: `Authorization: Bearer sf_live_key_xyz`
- Scripts: `dev` (tsx watch), `build` (tsc), `test` (vitest)

### @flowstate/gateway (npm package in backend/gateway/)
**Client SDK** (React, zero backend deps):
- `FlowStateProvider.tsx` — Context wrapper (projectId, apiKey, theme, callbacks)
- `PayButton.tsx` — Checkout flow: overlay → shipping selection → wallet approval → escrow
- `OrderTracker.tsx` — Real-time 7-state progress bar (WebSocket)
- `BuyerChat.tsx` — Chat widget connected to BuyerAgent
- `SellerDashboard.tsx` — Orders, label download, payouts, metrics, SellerAgent chat
- `AdminDashboard.tsx` — Platform analytics, seller management, webhook logs, AdminAgent chat

**Server SDK** (Node.js):
- `FlowStateServer.ts` — Webhook receiver: HMAC-SHA256 verification + typed event parsing
- `webhookVerifier.ts` — `verifySignature(payload, signature, secret)`
- `apiClient.ts` — Typed fetch wrapper for all Flow State API endpoints

### packages/contracts (Solidity)
- Solidity 0.8.20, Hardhat, OpenZeppelin, ethers.js v6
- **MockRLUSD.sol** — ERC-20 with public `mint()` (testnet token, "FLUSD")
- **EscrowStateMachine.sol** — Core FSM: holds buyer tokens, 7 states, partial payouts per transition, dispute branching, grace period timer
- **DisputeResolver.sol** — Dispute lifecycle: evidence CID, 72h seller response, auto-resolve on timeout
- **PaymentSplitter.sol** — `releasePartial()`, `releaseFinal()` (with platform fee deduction), `refundBuyer()`

**XRPL EVM Testnet config:**
- RPC: `https://rpc.testnet.xrplevm.org`
- Chain ID: `1449000`
- Gas token: XRP (from faucet)
- Explorer: `https://explorer.testnet.xrplevm.org`

### mcp-agents
- LangChain + OpenAI, MCP SDK, Zod
- Buyer/Seller/Admin agents with 5 skills each

---

## Backend API Endpoints

| Group    | Prefix             | Key Endpoints                                                                         |
|----------|--------------------|---------------------------------------------------------------------------------------|
| Orders   | `/api/v1/orders`   | `POST /create`, `POST /:id/select-shipping`, `POST /:id/confirm-escrow`, `POST /:id/confirm-label-printed`, `POST /:id/finalize`, `GET /:id` |
| Shipping | `/api/v1/shipping` | `POST /webhook/shippo`, `GET /rates`, `GET /track/:orderId`                           |
| Sellers  | `/api/v1/sellers`  | `POST /onboard`, `GET /:id/orders`, `GET /:id/metrics`, `GET /:id/payouts`            |
| Disputes | `/api/v1/disputes` | `POST /create`, `POST /:id/respond`, `POST /:id/resolve`                              |
| Platform | `/api/v1/platform` | `GET /:projectId/analytics`, `GET /:projectId/sellers`, `GET /:projectId/gas-costs`   |
| Webhooks | `/api/v1/webhooks` | `POST /register`, `GET /logs`                                                         |
| Agents   | `/api/v1/agents`   | `POST /chat`                                                                          |
| Auth     | `/api/v1/auth`     | `POST /projects/create`, `POST /api-keys/rotate`                                      |

---

## Escrow State Machine (7 States)

```
INITIATED → ESCROWED → LABEL_CREATED → SHIPPED → IN_TRANSIT → DELIVERED → FINALIZED
                                                                  │
                                                                  └─► DISPUTED (branches off DELIVERED)
```

**Payout schedule** (default seller split: 15/15/20/35/15):
- ESCROWED: funds locked in contract
- LABEL_CREATED: 15% released to seller
- SHIPPED: 15% released
- IN_TRANSIT: 20% released
- DELIVERED: 35% released + 48h grace period starts
- FINALIZED: 15% released (minus platform fee, e.g. 2.5%) — triggered by cron after grace period if no disputes

**Dispute branch** (from DELIVERED):
- DISPUTED: remaining funds frozen
- DisputeResolver: 72h for seller to respond, then admin/auto resolution
- Outcomes: full refund to buyer, release to seller, or partial split

---

## Data Flow Summary

| Data                 | Path                                              | Storage                             |
|----------------------|---------------------------------------------------|-------------------------------------|
| Product listings     | Platform DB → Next.js (Prisma)                    | PostgreSQL (platform-side)          |
| Shipping rates       | Shippo → Backend → PayButton overlay              | Cached in Redis                     |
| Token approval       | Buyer wallet → MockRLUSD contract                 | XRPL EVM state                      |
| Escrowed funds       | MockRLUSD → EscrowFSM contract                    | Smart contract storage              |
| Invoices/labels      | Backend → Pinata IPFS                             | IPFS (CID in DB + on-chain)         |
| Tracking updates     | Carrier → Shippo webhook → Backend                | PostgreSQL + IPFS + on-chain        |
| Streaming payouts    | EscrowFSM → PaymentSplitter → seller wallet       | XRPL EVM state                      |
| Dispute evidence     | Buyer upload → Backend → Pinata IPFS              | IPFS (CID on-chain)                 |
| Agent chat           | Widget → Backend → Pinata OpenClaw agent          | Ephemeral (agent session)           |
| Webhook events       | Backend → Developer's URL (HMAC-SHA256 signed)    | Webhook logs in PostgreSQL          |
| Real-time status     | Backend Event Bus → Client SDK (WebSocket)        | In-memory (transient)               |

---

## AI Agents (Pinata OpenClaw)

All use NVIDIA Nemotron via OpenRouter. Each has 5 skills that call the Flow State API.

**BuyerAgent skills:** `order-status`, `track-shipment`, `file-dispute`, `get-receipt`, `list-my-orders`

**SellerAgent skills:** `list-orders`, `get-metrics`, `confirm-label`, `respond-dispute`, `get-payouts`

**AdminAgent skills:** `get-analytics`, `list-sellers`, `flagged-sellers`, `webhook-logs`, `gas-report`

---

## Key Workflows

### Checkout (Buyer)
1. Buyer clicks PayButton → overlay renders
2. `POST /orders/create` → Shippo fetches shipping rates → buyer selects option
3. `POST /orders/:id/select-shipping` → label purchased from Shippo, pinned to IPFS
4. Buyer approves MockRLUSD spending in MetaMask (tx 1), then deposits into EscrowFSM (tx 2)
5. `POST /orders/:id/confirm-escrow` → backend verifies on-chain tx, generates invoice, pins to IPFS, stores CID on-chain
6. State: INITIATED → ESCROWED. Webhook `escrow.created` dispatched.

### Fulfillment (Seller)
1. Seller views orders in SellerDashboard (`GET /sellers/:id/orders?status=ESCROWED`)
2. Downloads shipping label (from IPFS), prints it, clicks "Confirm Printed"
3. `POST /orders/:id/confirm-label-printed` → pin receipt → `advanceState()` on-chain → 15% payout released
4. Carrier scans trigger Shippo webhooks → `POST /shipping/webhook/shippo` → backend advances state automatically (SHIPPED → IN_TRANSIT → DELIVERED) with payouts at each transition

### Finalization
1. After delivery, 48h grace period starts
2. Cron job fires after expiry, checks for no active disputes
3. `finalize()` on-chain → final 15% released (minus platform fee) → `order.finalized` webhook

### Dispute
1. Buyer files dispute (via BuyerChat agent or directly) during grace period
2. Evidence pinned to IPFS, `initiateDispute()` freezes remaining funds on-chain
3. `createDispute()` on DisputeResolver starts 72h seller response window
4. Seller can: accept (refund buyer), contest (upload counter-evidence → 7-day review), or timeout (auto-refund to buyer after 72h)

### Webhooks
- Backend signs payloads with HMAC-SHA256, sends POST to developer's registered URL
- Developer uses `FlowStateServer.verifyAndParse(body, signature)` to process
- Events: `escrow.created`, `state.advanced`, `payout.released`, `order.finalized`, `dispute.created`
- Failed deliveries retry with exponential backoff (up to 5x)

---

## Platform-Side DB Tables (demo-store only)

- `users` — id, email, role (buyer/seller/admin), wallet_address
- `products` — id, name, description, price_usd, weight_oz, dimensions, seller_id, image_url
- `platform_config` — flowstate_project_id, flowstate_api_key, fee_percentage

All order/escrow/payout/dispute/shipping data lives in the gateway backend — the platform reads it via the SDK.

---

## Type Definitions (@flowstate/gateway)

- `types/orders.ts` — Order, OrderItem, ShippingOption, EscrowDetails, PayoutSchedule
- `types/sellers.ts` — Seller, SellerMetrics, PayoutRecord
- `types/disputes.ts` — Dispute, DisputeEvidence, Resolution
- `types/agents.ts` — ChatMessage, AgentResponse, SuggestedAction
- `types/webhooks.ts` — WebhookEvent, WebhookPayload per event type
- `types/config.ts` — FlowStateConfig, ThemeConfig
- `contracts/*.json` — ABIs for EscrowStateMachine, DisputeResolver, PaymentSplitter, MockRLUSD
