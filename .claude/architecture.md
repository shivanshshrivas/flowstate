# Flow State — Architecture & Workflow Specification

---

## Part 1: System Decomposition

### A. The Demo E-Commerce Platform

A standalone Next.js storefront that imports `@flowstate/gateway` and demonstrates a complete buyer/seller/admin experience.

| Layer     | Technology                        | Role                                    |
| --------- | --------------------------------- | --------------------------------------- |
| Framework | Next.js 14+ (App Router)          | SSR, routing, API routes                |
| Language  | TypeScript                        | End-to-end type safety                  |
| Styling   | Tailwind CSS + shadcn/ui          | UI components                           |
| Database  | PostgreSQL (via Neon or Supabase) | Products, users, sessions               |
| ORM       | Prisma                            | Schema, migrations, queries             |
| Auth      | NextAuth.js                       | Email/password + wallet-based login     |
| Wallet    | RainbowKit + wagmi + viem         | MetaMask connection to XRPL EVM testnet |
| State     | Zustand                           | Client-side state management            |
| Hosting   | Vercel                            | Deployment                              |
| Gateway   | `@flowstate/gateway`              | The entire Flow State integration       |

**Pages:**

- `/` — Product listing
- `/product/:id` — Product detail + `<PayButton />`
- `/orders` — Buyer order history + `<OrderTracker />`
- `/seller` — `<SellerDashboard />` (from gateway)
- `/admin` — `<AdminDashboard />` (from gateway)
- `/api/webhooks/flowstate` — Server-side webhook receiver (uses gateway's `FlowStateServer`)

**Database tables (platform-side only):**

- `users` — id, email, role (buyer/seller/admin), wallet_address
- `products` — id, name, description, price_usd, weight_oz, dimensions, seller_id, image_url
- `platform_config` — flowstate_project_id, flowstate_api_key, fee_percentage

Everything else (orders, escrows, payouts, disputes, shipping) lives in the gateway's backend — the platform just reads it via the gateway SDK.

---

### B. The Gateway (`@flowstate/gateway`)

Seven sub-components that ship as one package plus hosted infrastructure.

```plain
@flowstate/gateway
│
├── 1. Client SDK ──────────── React components the developer drops into their frontend
├── 2. Server SDK ──────────── Node.js utilities for webhook handling + typed API client
├── 3. Backend API ─────────── Hosted REST API (api.flowstate.xyz) that orchestrates everything
├── 4. Smart Contracts ─────── Solidity contracts on XRPL EVM Sidechain
├── 5. Integration Bridges ─── Shippo (shipping), Pinata (IPFS), XRPL (blockchain)
├── 6. AI Agents ───────────── 3 OpenClaw agents hosted on Pinata (Nemotron via OpenRouter)
└── 7. Contract ABIs + Types ── TypeScript definitions + compiled contract interfaces
```

---

#### Sub-Component 1: Client SDK

What ships in the npm package's `client/` directory. Pure React, zero backend dependencies.

| File                    | Technology           | What It Does                                                                      |
| ----------------------- | -------------------- | --------------------------------------------------------------------------------- |
| `FlowStateProvider.tsx` | React Context        | Wraps app with config (projectId, apiKey, theme, callbacks)                       |
| `PayButton.tsx`         | React + wagmi + viem | Checkout button → overlay → shipping selection → wallet approval → escrow deposit |
| `OrderTracker.tsx`      | React + WebSocket    | Real-time 7-state progress bar with shipping details                              |
| `BuyerChat.tsx`         | React + WebSocket    | Embedded chat widget connected to BuyerAgent                                      |
| `SellerDashboard.tsx`   | React + recharts     | Orders table, label download, payout history, metrics charts, SellerAgent chat    |
| `AdminDashboard.tsx`    | React + recharts     | Platform analytics, seller management, webhook logs, AdminAgent chat              |

**Dependencies bundled:**

- `wagmi` + `viem` — wallet connection and contract interaction
- `recharts` — dashboard charts
- WebSocket client — real-time updates from gateway Event Bus

---

#### Sub-Component 2: Server SDK

What ships in the npm package's `server/` directory. Node.js only.

| File                 | Technology         | What It Does                                                                                                                     |
| -------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `FlowStateServer.ts` | Node.js + crypto   | Webhook receiver: verifies HMAC-SHA256 signature, parses event, calls developer's handler                                        |
| `webhookVerifier.ts` | Node.js crypto     | `verifySignature(payload, signature, secret) → boolean`                                                                          |
| `apiClient.ts`       | fetch + TypeScript | Typed wrapper around all Flow State API endpoints. Developer uses this to query orders, sellers, etc. from their own server code |

---

#### Sub-Component 3: Backend API (hosted)

The central orchestration layer. Hosted at `api.flowstate.xyz`. Not in the npm package — the SDK talks to it over HTTPS.

| Layer      | Technology                    | Role                                                                 |
| ---------- | ----------------------------- | -------------------------------------------------------------------- |
| Runtime    | Node.js 20+                   | Server                                                               |
| Framework  | Fastify                       | HTTP server, validation, routing                                     |
| Language   | TypeScript                    | Type safety                                                          |
| Database   | PostgreSQL (Neon)             | Orders, sellers, disputes, sessions, webhook registrations           |
| ORM        | Drizzle                       | Lightweight, type-safe queries                                       |
| Cache      | Redis (Upstash)               | Rate limiting, session cache, job queue                              |
| Queue      | BullMQ                        | Async processing: state transitions, webhook delivery, agent routing |
| Real-time  | WebSocket (ws)                | Event Bus — pushes order updates to connected clients                |
| Auth       | API key validation            | Every request carries `Authorization: Bearer sf_live_key_xyz`        |
| Blockchain | ethers.js v6                  | Read/write to XRPL EVM smart contracts                               |
| Shipping   | Shippo Node SDK               | Rate shopping, label purchase, tracking webhook receiver             |
| Storage    | Pinata SDK                    | IPFS pinning for invoices, labels, evidence, receipts                |
| Agents     | HTTP calls to Pinata OpenClaw | Routes chat messages to the correct agent                            |

**Endpoint groups:**

| Group    | Prefix             | Endpoints                                                                                                                                    |
| -------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Orders   | `/api/v1/orders`   | `POST /create`, `POST /:id/select-shipping`, `POST /:id/confirm-escrow`, `POST /:id/confirm-label-printed`, `POST /:id/finalize`, `GET /:id` |
| Shipping | `/api/v1/shipping` | `POST /webhook/shippo`, `GET /rates`, `GET /track/:orderId`                                                                                  |
| Sellers  | `/api/v1/sellers`  | `POST /onboard`, `GET /:id/orders`, `GET /:id/metrics`, `GET /:id/payouts`                                                                   |
| Disputes | `/api/v1/disputes` | `POST /create`, `POST /:id/respond`, `POST /:id/resolve`                                                                                     |
| Platform | `/api/v1/platform` | `GET /:projectId/analytics`, `GET /:projectId/sellers`, `GET /:projectId/gas-costs`                                                          |
| Webhooks | `/api/v1/webhooks` | `POST /register`, `GET /logs`                                                                                                                |
| Agents   | `/api/v1/agents`   | `POST /chat`                                                                                                                                 |
| Auth     | `/api/v1/auth`     | `POST /projects/create`, `POST /api-keys/rotate`                                                                                             |

---

#### Sub-Component 4: Smart Contracts (XRPL EVM Sidechain)

| Contract                 | Language        | What It Does                                                                                                                                         |
| ------------------------ | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MockRLUSD.sol`          | Solidity 0.8.20 | ERC-20 token with public `mint()`. Simulates RLUSD for testnet. Extends OpenZeppelin ERC20.                                                          |
| `EscrowStateMachine.sol` | Solidity 0.8.20 | Core FSM: holds buyer tokens, advances through 7 states, releases partial payouts at each transition, handles dispute branching, grace period timer. |
| `DisputeResolver.sol`    | Solidity 0.8.20 | Dispute lifecycle: creation with evidence CID, 72h seller response window, resolution execution (refund/release/partial), auto-resolve on timeout.   |
| `PaymentSplitter.sol`    | Solidity 0.8.20 | Token movement: `releasePartial()`, `releaseFinal()` (with platform fee deduction), `refundBuyer()`. Holds platform fee wallet address.              |

**Tooling:**

| Tool                   | Role                                         |
| ---------------------- | -------------------------------------------- |
| Hardhat                | Compile, test, deploy, verify                |
| OpenZeppelin Contracts | ERC-20, ReentrancyGuard, Ownable, Pausable   |
| ethers.js v6           | Deployment scripts, interaction              |
| Hardhat Ignition       | Deterministic deployments                    |
| Chai + Hardhat Network | Unit tests (every function, every edge case) |

**Network config:**

- Testnet RPC: `https://rpc.testnet.xrplevm.org`
- Chain ID: `1449000`
- Gas token: XRP (from faucet)
- Explorer: `https://explorer.testnet.xrplevm.org`

---

#### Sub-Component 5: Integration Bridges

| Bridge        | Service            | SDK/Protocol                        | What Flows Through It                                                                                                                 |
| ------------- | ------------------ | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Shippo Bridge | Shippo API         | `shippo` npm package (sandbox mode) | Shipping rates, label PDFs, tracking webhooks                                                                                         |
| Pinata Bridge | Pinata Cloud       | `pinata` npm SDK                    | Invoice JSONs/PDFs, label PDFs, dispute evidence images, state transition receipts → all pinned to IPFS, CIDs stored in DB + on-chain |
| XRPL Bridge   | XRPL EVM Sidechain | `ethers.js` v6                      | Contract deployments, state transitions, token transfers, event listening                                                             |

---

#### Sub-Component 6: AI Agents

Three OpenClaw agents hosted on Pinata (agents.pinata.cloud).

| Agent       | Personality                      | LLM                            | Channel                               |
| ----------- | -------------------------------- | ------------------------------ | ------------------------------------- |
| BuyerAgent  | Helpful shopping assistant       | NVIDIA Nemotron via OpenRouter | Web chat widget (BuyerChat component) |
| SellerAgent | Data-driven operations assistant | NVIDIA Nemotron via OpenRouter | Web chat widget (in SellerDashboard)  |
| AdminAgent  | Platform operations analyst      | NVIDIA Nemotron via OpenRouter | Web chat widget (in AdminDashboard)   |

**Config for each agent on Pinata:**

- Provider: OpenRouter
- API Key: stored in Pinata Secrets Vault as `OPENROUTER_API_KEY`
- Model: `nvidia/nemotron-3-nano-30b-a3b` (via OpenRouter — 256K context, purpose-built for agentic AI)
- Additional secret: `FLOWSTATE_API_KEY` — injected so skills can call the Flow State API

**BuyerAgent Skills (5):**

| Skill            | Trigger Phrases                               | API Call                                             | Data Returned                                                 |
| ---------------- | --------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------- |
| `order-status`   | "where is my order", "order status"           | `GET /api/v1/orders/:id`                             | Full order state, financials, shipping info                   |
| `track-shipment` | "track my package", "shipping update"         | `GET /api/v1/shipping/track/:orderId`                | Carrier, location, ETA, tracking history with IPFS proof CIDs |
| `file-dispute`   | "file a dispute", "wrong item", "damaged"     | `POST /api/v1/disputes/create`                       | Dispute ID, frozen amount, seller deadline, resolution paths  |
| `get-receipt`    | "show invoice", "receipt", "proof of payment" | `GET /api/v1/orders/:id` → extract `invoice.pdf_url` | IPFS gateway URL to invoice PDF                               |
| `list-my-orders` | "my orders", "order history"                  | `GET /api/v1/orders?buyer=<wallet>`                  | Paginated order list with status and amounts                  |

**SellerAgent Skills (5):**

| Skill             | Trigger Phrases                             | API Call                                         | Data Returned                                                      |
| ----------------- | ------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------ |
| `list-orders`     | "show my orders", "pending orders"          | `GET /api/v1/sellers/:id/orders?status=ESCROWED` | Orders needing action, with label URLs                             |
| `get-metrics`     | "my metrics", "dispute rate", "performance" | `GET /api/v1/sellers/:id/metrics?period=30d`     | Order counts, revenue, fulfillment speed, dispute rate, reputation |
| `confirm-label`   | "label printed", "I shipped it"             | `POST /api/v1/orders/:id/confirm-label-printed`  | State transition confirmation, payout amount released              |
| `respond-dispute` | "respond to dispute", "contest dispute"     | `POST /api/v1/disputes/:id/respond`              | Updated dispute status, resolution timeline                        |
| `get-payouts`     | "my payouts", "earnings", "how much"        | `GET /api/v1/sellers/:id/payouts`                | Payout history: amount, tx hash, timestamp per release             |

**AdminAgent Skills (5):**

| Skill             | Trigger Phrases                               | API Call                                               | Data Returned                                                  |
| ----------------- | --------------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------- |
| `get-analytics`   | "platform stats", "how are we doing"          | `GET /api/v1/platform/:projectId/analytics`            | Order volume, revenue, dispute rate, API usage, gas costs      |
| `list-sellers`    | "show sellers", "seller list"                 | `GET /api/v1/platform/:projectId/sellers`              | All sellers with volume, dispute rate, reputation              |
| `flagged-sellers` | "problem sellers", "flagged", "high disputes" | `GET /api/v1/platform/:projectId/sellers?flagged=true` | Sellers with dispute rate > threshold                          |
| `webhook-logs`    | "webhook status", "failed webhooks"           | `GET /api/v1/webhooks/logs`                            | Recent webhook deliveries with status codes and retry counts   |
| `gas-report`      | "gas costs", "on-chain costs"                 | `GET /api/v1/platform/:projectId/gas-costs`            | Total gas spent, avg per transition, cost by contract function |

---

#### Sub-Component 7: Contract ABIs + Types

| File                                | Contents                                                        |
| ----------------------------------- | --------------------------------------------------------------- |
| `contracts/EscrowStateMachine.json` | ABI for frontend contract interaction via wagmi                 |
| `contracts/DisputeResolver.json`    | ABI                                                             |
| `contracts/PaymentSplitter.json`    | ABI                                                             |
| `contracts/MockRLUSD.json`          | ABI                                                             |
| `types/orders.ts`                   | Order, OrderItem, ShippingOption, EscrowDetails, PayoutSchedule |
| `types/sellers.ts`                  | Seller, SellerMetrics, PayoutRecord                             |
| `types/disputes.ts`                 | Dispute, DisputeEvidence, Resolution                            |
| `types/agents.ts`                   | ChatMessage, AgentResponse, SuggestedAction                     |
| `types/webhooks.ts`                 | WebhookEvent, WebhookPayload for each event type                |
| `types/config.ts`                   | FlowStateConfig, ThemeConfig                                    |

---

## Part 2: Architecture — How Everything Connects

```plain
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           DEVELOPER'S APPLICATION                               │
│                        (e.g., the Demo E-Commerce Store)                        │
│                                                                                 │
│  Next.js App                                                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │Product Pages │  │ <PayButton/> │  │ <OrderTrack/>│  │ <BuyerChat/> │         │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘         │
│         │                 │                 │                 │                 │
│  ┌──────┴─────────────────┴─────────────────┴─────────────────┴───────┐         │
│  │                    <FlowStateProvider />                           │         │
│  │              projectId, apiKey, theme, callbacks                   │         │
│  └────────────────────────────────┬───────────────────────────────────┘         │
│                                   │                                             │
│  Server-side:                     │                                             │
│  ┌────────────────────────┐       │                                             │
│  │ FlowStateServer        │       │  (webhook handler in /api/webhooks)         │
│  │ verifies signatures    │       │                                             │
│  │ calls dev's handlers   │       │                                             │
│  └────────────┬───────────┘       │                                             │
│               │                   │                                             │
└───────────────┼───────────────────┼─────────────────────────────────────────────┘
                │                   │
     Webhook    │      HTTPS + WebSocket
     delivery   │                   │
                │                   │
┌───────────────▼───────────────────▼─────────────────────────────────────────────┐
│                          FLOW STATE BACKEND API                                 │
│                        api.flowstate.xyz (hosted)                               │
│                                                                                 │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐        │
│  │ Orders  │ │Shipping │ │ Sellers │ │Disputes │ │Platform │ │ Agents  │        │
│  │ API     │ │ API     │ │ API     │ │ API     │ │ API     │ │ API     │        │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘        │
│       │           │           │           │           │           │             │
│  ┌────▼───────────▼───────────▼───────────▼───────────▼───────────▼────┐        │
│  │                       Orchestration Layer                           │        │
│  │   BullMQ job queue  ·  Event Bus (WebSocket)  ·  Cron scheduler     │        │
│  └───────┬────────────────────┬────────────────────┬───────────────────┘        │
│          │                    │                    │                            │
│  ┌───────▼───────┐    ┌───────▼───────┐    ┌───────▼───────┐                    │
│  │ PostgreSQL    │    │ Redis         │    │ Webhook       │                    │
│  │ (Neon)        │    │ (Upstash)     │    │ Dispatcher    │                    │
│  │ orders,sellers│    │ cache, queue  │    │ → dev's URL   │                    │
│  │ disputes,keys │    │ rate limits   │    │ HMAC signed   │                    │
│  └───────────────┘    └───────────────┘    └───────────────┘                    │
│                                                                                 │
└──────────┬─────────────────────┬─────────────────────┬──────────────────────────┘
           │                     │                     │
           ▼                     ▼                     ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  XRPL EVM        │  │  Shippo          │  │  Pinata          │
│  Sidechain       │  │                  │  │                  │
│                  │  │  Rate shopping   │  │  IPFS pinning    │
│  EscrowFSM.sol   │  │  Label purchase  │  │  (invoices,      │
│  DisputeRes.sol  │  │  Tracking hooks  │  │   labels,        │
│  PaySplitter.sol │  │  Carrier network │  │   evidence,      │
│  MockRLUSD.sol   │  │  (sandbox mode)  │  │   receipts)      │
│                  │  │                  │  │                  │
│  ethers.js v6    │  │  Shippo Node SDK │  │  Pinata SDK      │
│  testnet RPC     │  │                  │  │                  │
│  chain 1449000   │  │                  │  │  ┌────────────┐  │
└──────────────────┘  └──────────────────┘  │  │ OpenClaw   │  │
                                            │  │ Agents     │  │
                                            │  │            │  │
  ┌──────────────────────────────────────┐  │  │ Buyer (5)  │  │
  │        Buyer's MetaMask Wallet       │  │  │ Seller (5) │  │
  │  Connected to XRPL EVM Testnet       │  │  │ Admin (5)  │  │
  │  Holds MockRLUSD tokens              │  │  │            │  │
  │  Signs approve() + escrow deposit    │  │  │ Nemotron   │  │
  │                                      │  │  │ via        │  │
  │  Also: Seller wallet (receives       │  │  │ OpenRouter │  │
  │  streaming payouts)                  │  │  └────────────┘  │
  │  Also: Platform fee wallet           │  │                  │
  └──────────────────────────────────────┘  └──────────────────┘
```

### Data Flow Summary

| Data                   | Flows From → To                               | Protocol                 | Stored In                                |
| ---------------------- | --------------------------------------------- | ------------------------ | ---------------------------------------- |
| Product listings       | Platform DB → Next.js pages                   | Prisma query             | PostgreSQL (platform)                    |
| Shipping rates         | Shippo → Backend API → PayButton overlay      | HTTPS                    | Cached in Redis                          |
| Buyer's token approval | Buyer wallet → MockRLUSD contract             | On-chain tx (EVM)        | XRPL EVM state                           |
| Escrowed funds         | MockRLUSD → EscrowFSM contract                | On-chain tx (EVM)        | Smart contract storage                   |
| Invoice PDF            | Backend → Pinata IPFS                         | Pinata SDK               | IPFS (CID in PostgreSQL + on-chain)      |
| Shipping label         | Shippo → Backend → Pinata IPFS                | Shippo SDK → Pinata SDK  | IPFS (CID in PostgreSQL)                 |
| Tracking updates       | Carrier → Shippo → Backend webhook            | HTTPS POST               | PostgreSQL + IPFS proof + on-chain state |
| Streaming payouts      | EscrowFSM → PaymentSplitter → Seller wallet   | On-chain tx (EVM)        | XRPL EVM state                           |
| Dispute evidence       | Buyer upload → Backend → Pinata IPFS          | HTTPS + Pinata SDK       | IPFS (CID on-chain)                      |
| Agent chat messages    | Chat widget → Backend → Pinata OpenClaw agent | WebSocket + HTTPS        | Agent session (ephemeral)                |
| Webhook events         | Backend → Developer's registered URL          | HTTPS POST (HMAC signed) | Webhook logs in PostgreSQL               |
| Real-time status       | Backend Event Bus → Client SDK                | WebSocket                | In-memory (transient)                    |

---

## Part 3: Detailed Sequence Diagrams

---

### WORKFLOW 1: DEVELOPER — First Install & Integration

```plain
Developer                    Terminal/IDE                    npm Registry
    │                            │                              │
    │  npm install               │                              │
    │  @flowstate/gateway        │                              │
    │───────────────────────────>│                              │
    │                            │─────────────────────────────>│
    │                            │   Download package           │
    │                            │<─────────────────────────────│
    │                            │                              │
    │  Package installed.        │                              │
    │  Contains:                 │                              │
    │   client/ (React)          │                              │
    │   server/ (Node.js)        │                              │
    │   contracts/ (ABIs)        │                              │
    │   types/ (TypeScript)      │                              │
    │<───────────────────────────│                              │
    │                            │                              │


Developer                    Flow State Website              Backend API
    │                            │                              │
    │  Sign up at                │                              │
    │  flowstate.xyz/signup      │                              │
    │───────────────────────────>│                              │
    │                            │                              │
    │  Create project:           │                              │
    │  "MyShop"                  │                              │
    │───────────────────────────>│                              │
    │                            │  POST /api/v1/auth/          │
    │                            │  projects/create             │
    │                            │─────────────────────────────>│
    │                            │                              │
    │                            │  { project_id:               │
    │                            │    "fs_proj_abc123",         │
    │                            │    api_key:                  │
    │                            │    "fs_live_key_xyz" }       │
    │                            │<─────────────────────────────│
    │                            │                              │
    │  Here are your             │                              │
    │  credentials.              │                              │
    │<───────────────────────────│                              │
    │                            │                              │
    │  Configure platform fee:   │                              │
    │  2.5% (default)            │                              │
    │  Platform fee wallet:      │                              │
    │  0xPlatformWallet...       │                              │
    │───────────────────────────>│                              │
    │                            │  POST /api/v1/platform/      │
    │                            │  :projectId/config           │
    │                            │─────────────────────────────>│
    │                            │                              │
    │  Register webhook URL:     │                              │
    │  https://myshop.com/       │                              │
    │  api/webhooks/flowstate    │                              │
    │───────────────────────────>│                              │
    │                            │  POST /api/v1/webhooks/      │
    │                            │  register                    │
    │                            │─────────────────────────────>│
    │                            │                              │
```

**What the developer writes in their code:**

```typescript
// layout.tsx — wrap entire app
import { FlowStateProvider } from "@flowstate/gateway";

<FlowStateProvider
  projectId="fs_proj_abc123"
  apiKey="fs_live_key_xyz"
  network="testnet"
  theme={{
    primaryColor: "#1a1a2e",
    brandName: "MyShop",
    borderRadius: "8px"
  }}
  contracts={{
    escrow: "0xDeployedEscrowFSM...",
    token: "0xDeployedMockRLUSD...",
    dispute: "0xDeployedDisputeResolver...",
    splitter: "0xDeployedPaymentSplitter..."
  }}
  onWebhook={{
    "escrow.created": (data) => updateLocalDB(data),
    "order.finalized": (data) => sendConfirmationEmail(data)
  }}
>
  {children}
</FlowStateProvider>


// product page — add checkout button
import { PayButton } from "@flowstate/gateway";

<PayButton
  orderId={order.id}
  items={[{
    id: "item_001",
    name: "Wireless Headphones",
    quantity: 1,
    unit_price_usd: 39.99,
    weight_oz: 8.5,
    dimensions: { length: 7, width: 5, height: 3, unit: "in" }
  }]}
  sellerWallet="0xSellerAddress..."
  buyerShippingAddress={{
    name: "Jane Doe", street1: "123 Main St",
    city: "Lawrence", state: "KS", zip: "66044", country: "US"
  }}
  sellerAddress={{
    name: "ProBuds Inc", street1: "456 Commerce Ave",
    city: "Austin", state: "TX", zip: "73301", country: "US"
  }}
  onComplete={(result) => router.push(`/orders/${result.order_id}`)}
  onError={(err) => toast.error(err.message)}
/>


// order history page — embed tracker
import { OrderTracker } from "@flowstate/gateway";
<OrderTracker orderId="fs_ord_7f8a9b2c" />


// buyer support — embed agent chat
import { BuyerChat } from "@flowstate/gateway";
<BuyerChat userId={user.walletAddress} />


// seller section — embed full dashboard
import { SellerDashboard } from "@flowstate/gateway";
<SellerDashboard sellerId="fs_sel_def456" />


// admin section — embed full dashboard
import { AdminDashboard } from "@flowstate/gateway";
<AdminDashboard projectId="fs_proj_abc123" />


// server-side webhook handler: /api/webhooks/flowstate/route.ts
import { FlowStateServer } from "@flowstate/gateway/server";

const flowstate = new FlowStateServer({
  apiKey: "fs_live_key_xyz",
  webhookSecret: "whsec_your_signing_secret"
});

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("x-flowstate-signature");

  const event = flowstate.verifyAndParse(body, signature);

  switch (event.type) {
    case "escrow.created":
      // Update local order status
      break;
    case "state.advanced":
      // Notify buyer via email
      break;
    case "order.finalized":
      // Mark order complete in local DB
      break;
    case "dispute.created":
      // Alert admin
      break;
  }

  return new Response("ok", { status: 200 });
}
```

---

### WORKFLOW 2: SELLER — Onboarding & First Sale

```plain
Seller                     Demo Store              Backend API             XRPL EVM
  │                           │                        │                      │
  │  Visit /seller/signup     │                        │                      │
  │──────────────────────────>│                        │                      │
  │                           │                        │                      │
  │  Fill form:               │                        │                      │
  │  - Business name          │                        │                      │
  │  - Business address       │                        │                      │
  │  - Carrier account #s     │                        │                      │
  │  - Payout split prefs     │                        │                      │
  │    (15/15/20/35/15)       │                        │                      │
  │──────────────────────────>│                        │                      │
  │                           │                        │                      │
  │  "Connect Wallet"         │                        │                      │
  │  button (RainbowKit)      │                        │                      │
  │──────────────────────────>│                        │                      │
  │                           │                        │                      │
  │  MetaMask popup:          │                        │                      │
  │  "Connect to XRPL EVM     │                        │                      │
  │   Testnet (1449000)"      │                        │                      │
  │                           │                        │                      │
  │  If network not added:    │                        │                      │
  │  wallet_addEthereumChain  │                        │                      │
  │  { chainId: 1449000,      │                        │                      │
  │    rpc: rpc.testnet.      │                        │                      │
  │    xrplevm.org }          │                        │                      │
  │                           │                        │                      │
  │  Wallet connected:        │                        │                      │
  │  0xSellerAddress...       │                        │                      │
  │<──────────────────────────│                        │                      │
  │                           │                        │                      │
  │  Submit onboarding        │                        │                      │
  │──────────────────────────>│                        │                      │
  │                           │  POST /sellers/onboard │                      │
  │                           │  { wallet_address,     │                      │
  │                           │    business_name,      │                      │
  │                           │    business_address,   │                      │
  │                           │    carrier_accounts,   │                      │
  │                           │    payout_config }     │                      │
  │                           │───────────────────────>│                      │
  │                           │                        │                      │
  │                           │                        │  eth_call:           │
  │                           │                        │  check wallet exists │
  │                           │                        │  + has XRP for gas   │
  │                           │                        │─────────────────────>│
  │                           │                        │<─────────────────────│
  │                           │                        │                      │
  │                           │                        │  Verify MockRLUSD    │
  │                           │                        │  balance > 0 or      │
  │                           │                        │  can receive tokens  │
  │                           │                        │─────────────────────>│
  │                           │                        │<─────────────────────│
  │                           │                        │                      │
  │                           │                        │  Call Shippo:        │
  │                           │                        │  POST /carrier-      │
  │                           │                        │  accounts            │
  │                           │                        │  (link USPS, UPS)    │
  │                           │                        │                      │
  │                           │                        │  Validate payout     │
  │                           │                        │  config sums to 100  │
  │                           │                        │                      │
  │                           │                        │  Generate seller_id  │
  │                           │                        │  Store in PostgreSQL │
  │                           │                        │                      │
  │                           │  { seller_id:          │                      │
  │                           │    "fs_sel_def456",    │                      │
  │                           │    wallet_verified:    │                      │
  │                           │    true,               │                      │
  │                           │    carriers_linked:    │                      │
  │                           │    ["usps","ups"] }    │                      │
  │                           │<───────────────────────│                      │
  │                           │                        │                      │
  │  "Welcome! Your seller    │                        │                      │
  │   ID is fs_sel_def456.    │                        │                      │
  │   Redirecting to          │                        │                      │
  │   dashboard..."           │                        │                      │
  │<──────────────────────────│                        │                      │
  │                           │                        │                      │
  │  Redirect to /seller      │                        │                      │
  │  (SellerDashboard loads)  │                        │                      │
  │<──────────────────────────│                        │                      │
```

**Seller: Adding Products (platform-side, not gateway)**

```plain
Seller                     Demo Store              Platform DB
  │                           │                        │
  │  Go to /seller/products   │                        │
  │──────────────────────────>│                        │
  │                           │                        │
  │  Fill product form:       │                        │
  │  - Name, description      │                        │
  │  - Price (USD)            │                        │
  │  - Weight, dimensions     │                        │
  │  - Images                 │                        │
  │──────────────────────────>│                        │
  │                           │                        │
  │                           │  INSERT INTO products  │
  │                           │  (name, price_usd,     │
  │                           │   weight_oz, dims,     │
  │                           │   seller_id, image)    │
  │                           │───────────────────────>│
  │                           │                        │
  │  Product listed!          │                        │
  │  Visible on storefront.   │                        │
  │<──────────────────────────│                        │
```

**Seller: Fulfilling an Order (Label Print → Ship)**

```plain
Seller               SellerDashboard         Backend API           Shippo        EscrowFSM    PaymentSplitter    Pinata      Seller Wallet
  │                       │                      │                    │              │              │              │              │
  │  Open dashboard       │                      │                    │              │              │              │              │
  │──────────────────────>│                      │                    │              │              │              │              │
  │                       │  GET /sellers/       │                    │              │              │              │              │
  │                       │  :id/orders?         │                    │              │              │              │              │
  │                       │  status=ESCROWED     │                    │              │              │              │              │
  │                       │─────────────────────>│                    │              │              │              │              │
  │                       │                      │                    │              │              │              │              │
  │                       │  [{ order_id,        │                    │              │              │              │              │
  │                       │    items_summary,    │                    │              │              │              │              │
  │                       │    label_url,        │                    │              │              │              │              │
  │                       │    action_required:  │                    │              │              │              │              │
  │                       │    "Print label" }]  │                    │              │              │              │              │
  │                       │<─────────────────────│                    │              │              │              │              │
  │                       │                      │                    │              │              │              │              │
  │  See order card with  │                      │                    │              │              │              │              │
  │  "Download Label" +   │                      │                    │              │              │              │              │
  │  "Confirm Printed"    │                      │                    │              │              │              │              │
  │<──────────────────────│                      │                    │              │              │              │              │
  │                       │                      │                    │              │              │              │              │
  │  Click "Download      │                      │                    │              │              │              │              │
  │  Label" → fetches PDF │                      │                    │              │              │              │              │
  │  from Pinata IPFS     │                      │                    │              │              │              │              │
  │  gateway URL          │                      │                    │              │              │              │              │
  │                       │                      │                    │              │              │              │              │
  │  Prints physical      │                      │                    │              │              │              │              │
  │  label, sticks on box │                      │                    │              │              │              │              │
  │                       │                      │                    │              │              │              │              │
  │  Click "Confirm       │                      │                    │              │              │              │              │
  │  Printed"             │                      │                    │              │              │              │              │
  │──────────────────────>│                      │                    │              │              │              │              │
  │                       │  POST /orders/:id/   │                    │              │              │              │              │
  │                       │  confirm-label-      │                    │              │              │              │              │
  │                       │  printed             │                    │              │              │              │              │
  │                       │  { seller_wallet }   │                    │              │              │              │              │
  │                       │─────────────────────>│                    │              │              │              │              │
  │                       │                      │                    │              │              │              │              │
  │                       │                      │  Pin receipt JSON  │              │              │              │              │
  │                       │                      │  { label_printed,  │              │              │              │              │
  │                       │                      │    timestamp,      │              │              │              │              │
  │                       │                      │    seller_wallet } │              │              │              │              │
  │                       │                      │─────────────────────────────────────────────────>│              │              │
  │                       │                      │  receipt_cid       │              │              │              │              │
  │                       │                      │<─────────────────────────────────────────────────│              │              │
  │                       │                      │                    │              │              │              │              │
  │                       │                      │  advanceState(     │              │              │              │              │
  │                       │                      │   orderId,         │              │              │              │              │
  │                       │                      │   LABEL_CREATED,   │              │              │              │              │
  │                       │                      │   receipt_cid)     │              │              │              │              │
  │                       │                      │──────────────────────────────────>│              │              │              │
  │                       │                      │                    │              │              │              │              │
  │                       │                      │                    │  ESCROWED    │              │              │              │
  │                       │                      │                    │  → LABEL_    │              │              │              │
  │                       │                      │                    │  CREATED     │              │              │              │
  │                       │                      │                    │              │              │              │              │
  │                       │                      │                    │  emit        │              │              │              │
  │                       │                      │                    │  StateAdv'd  │              │              │              │
  │                       │                      │                    │              │              │              │              │
  │                       │                      │                    │  call        │              │              │              │
  │                       │                      │                    │  releasePart │              │              │              │
  │                       │                      │                    │  (id, 15%)   │              │              │              │
  │                       │                      │                    │  ───────────>│              │              │              │
  │                       │                      │                    │              │              │              │              │
  │                       │                      │                    │              │  transfer    │              │              │
  │                       │                      │                    │              │  6.83 FLUSD  │              │              │
  │                       │                      │                    │              │  ─────────────────────────────────────────>│
  │                       │                      │                    │              │              │              │              │
  │                       │                      │                    │  emit        │              │              │              │
  │                       │                      │                    │  PayoutRel'd │              │              │              │
  │                       │                      │<──────────────────────────────────│              │              │              │
  │                       │                      │                    │              │              │              │              │
  │                       │                      │  Dispatch webhook: │              │              │              │              │
  │                       │                      │  state.advanced +  │              │              │              │              │
  │                       │                      │  payout.released   │              │              │              │              │
  │                       │                      │  → dev's URL       │              │              │              │              │
  │                       │                      │                    │              │              │              │              │
  │                       │  { status:           │                    │              │              │              │              │
  │                       │    LABEL_CREATED,    │                    │              │              │              │              │
  │                       │    payout: 6.83,     │                    │              │              │              │              │
  │                       │    tx_hash: 0x... }  │                    │              │              │              │              │
  │                       │<─────────────────────│                    │              │              │              │              │
  │                       │                      │                    │              │              │              │              │
  │  "Label confirmed!    │                      │                    │              │              │              │              │
  │   6.83 FLUSD released │                      │                    │              │              │              │              │
  │   to your wallet."    │                      │                    │              │              │              │              │
  │<──────────────────────│                      │                    │              │              │              │              │
```

---

### WORKFLOW 3: BUYER — Full Purchase Lifecycle

**Step 1: Wallet Setup & Token Acquisition**

```plain
Buyer                      Demo Store              MetaMask              XRPL EVM Faucet       MockRLUSD Contract
  │                           │                       │                       │                       │
  │  Visit site, browse       │                       │                       │                       │
  │  products                 │                       │                       │                       │
  │──────────────────────────>│                       │                       │                       │
  │                           │                       │                       │                       │
  │  Click "Connect Wallet"   │                       │                       │                       │
  │  (RainbowKit button)      │                       │                       │                       │
  │──────────────────────────>│                       │                       │                       │
  │                           │  wallet_addEthereum   │                       │                       │
  │                           │  Chain (if needed)    │                       │                       │
  │                           │──────────────────────>│                       │                       │
  │                           │                       │                       │                       │
  │  MetaMask: "Add XRPL      │                       │                       │                       │
  │  EVM Testnet?" → Approve  │                       │                       │                       │
  │──────────────────────────>│                       │                       │                       │
  │                           │  eth_requestAccounts  │                       │                       │
  │                           │──────────────────────>│                       │                       │
  │                           │  0xBuyerAddress...    │                       │                       │
  │                           │<──────────────────────│                       │                       │
  │                           │                       │                       │                       │
  │  (First time: need gas)   │                       │                       │                       │
  │  Visit faucet.xrplevm.org │                       │                       │                       │
  │  Paste 0xBuyerAddress     │                       │                       │                       │
  │──────────────────────────────────────────────────────────────────────────>│                       │
  │  90 test XRP received     │                       │                       │                       │
  │<──────────────────────────────────────────────────────────────────────────│                       │
  │                           │                       │                       │                       │
  │  (Need MockRLUSD tokens)  │                       │                       │                       │
  │  Click "Get Test Tokens"  │                       │                       │                       │
  │  on demo store            │                       │                       │                       │
  │──────────────────────────>│                       │                       │                       │
  │                           │  MockRLUSD.mint(      │                       │                       │
  │                           │   buyerAddr, 1000e18) │                       │                       │
  │                           │  (demo store backend  │                       │                       │
  │                           │   calls this)         │                       │                       │
  │                           │──────────────────────────────────────────────────────────────────────>│
  │                           │                       │                       │                       │
  │  Wallet now shows:        │                       │                       │                       │
  │  90 XRP (gas) +           │                       │                       │                       │
  │  1000 FLUSD (spending)    │                       │                       │                       │
  │<──────────────────────────│                       │                       │                       │
```

**Step 2: Checkout Flow**

```plain
Buyer          PayButton        Backend API         Shippo          Pinata       MockRLUSD     EscrowFSM
  │               │                  │                 │               │             │             │
  │  Click "Buy   │                  │                 │               │             │             │
  │  with Flow    │                  │                 │               │             │             │
  │  State"       │                  │                 │               │             │             │
  │──────────────>│                  │                 │               │             │             │
  │               │                  │                 │               │             │             │
  │               │  Render checkout │                 │               │             │             │
  │               │  overlay:        │                 │               │             │             │
  │               │  order summary,  │                 │               │             │             │
  │               │  loading spinner │                 │               │             │             │
  │               │                  │                 │               │             │             │
  │               │  POST /orders/   │                 │               │             │             │
  │               │  create          │                 │               │             │             │
  │               │  { items,        │                 │               │             │             │
  │               │    addresses,    │                 │               │             │             │
  │               │    wallets }     │                 │               │             │             │
  │               │─────────────────>│                 │               │             │             │
  │               │                  │                 │               │             │             │
  │               │                  │  POST /shipments│               │             │             │
  │               │                  │  { addr_from:   │               │             │             │
  │               │                  │    seller_addr, │               │             │             │
  │               │                  │    addr_to:     │               │             │             │
  │               │                  │    buyer_addr,  │               │             │             │
  │               │                  │    parcel:      │               │             │             │
  │               │                  │    {w,h,l,wt} } │               │             │             │
  │               │                  │────────────────>│               │             │             │
  │               │                  │                 │               │             │             │
  │               │                  │  rates[] with   │               │             │             │
  │               │                  │  carrier,       │               │             │             │
  │               │                  │  service, price,│               │             │             │
  │               │                  │  ETA            │               │             │             │
  │               │                  │<────────────────│               │             │             │
  │               │                  │                 │               │             │             │
  │               │                  │  Convert USD →  │               │             │             │
  │               │                  │  FLUSD amounts  │               │             │             │
  │               │                  │  Store order as │               │             │             │
  │               │                  │  INITIATED in   │               │             │             │
  │               │                  │  PostgreSQL     │               │             │             │
  │               │                  │                 │               │             │             │
  │               │  { order_id,     │                 │               │             │             │
  │               │    shipping_     │                 │               │             │             │
  │               │    options[],    │                 │               │             │             │
  │               │    escrow_addr } │                 │               │             │             │
  │               │<─────────────────│                 │               │             │             │
  │               │                  │                 │               │             │             │
  │  Show shipping│                  │                 │               │             │             │
  │  options:     │                  │                 │               │             │             │
  │  USPS $5.50   │                  │                 │               │             │             │
  │  UPS $24.99   │                  │                 │               │             │             │
  │<──────────────│                  │                 │               │             │             │
  │               │                  │                 │               │             │             │
  │  Select       │                  │                 │               │             │             │
  │  "USPS $5.50" │                  │                 │               │             │             │
  │──────────────>│                  │                 │               │             │             │
  │               │                  │                 │               │             │             │
  │               │  POST /orders/   │                 │               │             │             │
  │               │  :id/select-     │                 │               │             │             │
  │               │  shipping        │                 │               │             │             │
  │               │  { option_id }   │                 │               │             │             │
  │               │─────────────────>│                 │               │             │             │
  │               │                  │                 │               │             │             │
  │               │                  │  POST /transact │               │             │             │
  │               │                  │  (purchase      │               │             │             │
  │               │                  │   label at      │               │             │             │
  │               │                  │   selected rate)│               │             │             │
  │               │                  │────────────────>│               │             │             │
  │               │                  │                 │               │             │             │
  │               │                  │  { label_pdf,   │               │             │             │
  │               │                  │    tracking_#,  │               │             │             │
  │               │                  │    carrier }    │               │             │             │
  │               │                  │<────────────────│               │             │             │
  │               │                  │                 │               │             │             │
  │               │                  │  Pin label PDF  │               │             │             │
  │               │                  │────────────────────────────────>│             │             │
  │               │                  │  label_cid      │               │             │             │
  │               │                  │<────────────────────────────────│             │             │
  │               │                  │                 │               │             │             │
  │               │  { escrow_amt:   │                 │               │             │             │
  │               │    "45.52",      │                 │               │             │             │
  │               │    approval_tx,  │                 │               │             │             │
  │               │    escrow_tx }   │                 │               │             │             │
  │               │<─────────────────│                 │               │             │             │
  │               │                  │                 │               │             │             │
  │  Show:        │                  │                 │               │             │             │
  │  "Total:      │                  │                 │               │             │             │
  │   45.52 FLUSD │                  │                 │               │             │             │
  │   Approve &   │                  │                 │               │             │             │
  │   Pay"        │                  │                 │               │             │             │
  │<──────────────│                  │                 │               │             │             │
  │               │                  │                 │               │             │             │
  │  Click        │                  │                 │               │             │             │
  │  "Approve     │                  │                 │               │             │             │
  │  & Pay"       │                  │                 │               │             │             │
  │──────────────>│                  │                 │               │             │             │
  │               │                  │                 │               │             │             │
  │  MetaMask     │                  │                 │               │             │             │
  │  popup #1:    │                  │                 │               │             │             │
  │  "Approve     │                  │                 │               │             │             │
  │   45.52 FLUSD │                  │                 │               │             │             │
  │   to Escrow   │                  │                 │               │             │             │
  │   contract?"  │                  │                 │               │             │             │
  │               │                  │                 │               │             │             │
  │  Confirm      │                  │                 │               │             │             │
  │  ───────────────────────────────────────────────────────────────────────────────>│             │
  │               │                  │                 │               │             │             │
  │               │                  │                 │               │  approve(   │             │
  │               │                  │                 │               │  escrowAddr,│             │
  │               │                  │                 │               │  45.52e18)  │             │
  │               │                  │                 │               │             │             │
  │  MetaMask     │                  │                 │               │             │             │
  │  popup #2:    │                  │                 │               │             │             │
  │  "Call        │                  │                 │               │             │             │
  │   transferAnd │                  │                 │               │             │             │
  │   Escrow?"    │                  │                 │               │             │             │
  │               │                  │                 │               │             │             │
  │  Confirm      │                  │                 │               │             │             │
  │  ─────────────────────────────────────────────────────────────────────────────────────────────>│
  │               │                  │                 │               │             │             │
  │               │                  │                 │               │             │  transfer   │
  │               │                  │                 │               │             │  45.52 from │
  │               │                  │                 │               │             │  buyer →    │
  │               │                  │                 │               │             │  contract   │
  │               │                  │                 │               │             │<────────────│
  │               │                  │                 │               │             │             │
  │               │                  │                 │               │             │  INITIATED  │
  │               │                  │                 │               │             │  → ESCROWED │
  │               │                  │                 │               │             │             │
  │               │                  │                 │               │             │  emit       │
  │               │                  │                 │               │             │  EscrowCre  │
  │               │                  │                 │               │             │  ated       │
  │               │                  │                 │               │             │             │
  │  tx_hash      │                  │                 │               │             │             │
  │  returned     │                  │                 │               │             │             │
  │<──────────────│                  │                 │               │             │             │
  │               │                  │                 │               │             │             │
  │               │  POST /orders/   │                 │               │             │             │
  │               │  :id/confirm-    │                 │               │             │             │
  │               │  escrow          │                 │               │             │             │
  │               │  { tx_hash }     │                 │               │             │             │
  │               │─────────────────>│                 │               │             │             │
  │               │                  │                 │               │             │             │
  │               │                  │  Verify on-chain│               │             │             │
  │               │                  │  tx receipt:    │               │             │             │
  │               │                  │  check Escrow   │               │             │             │
  │               │                  │  Created event, │               │             │             │
  │               │                  │  correct amount,│               │             │             │
  │               │                  │  correct parties│               │             │             │
  │               │                  │────────────────────────────────────────────────────────────>│
  │               │                  │<────────────────────────────────────────────────────────────│
  │               │                  │                 │               │             │             │
  │               │                  │  Generate       │               │             │             │
  │               │                  │  invoice JSON + │               │             │             │
  │               │                  │  PDF            │               │             │             │
  │               │                  │                 │               │             │             │
  │               │                  │  Pin invoice    │               │             │             │
  │               │                  │  JSON + PDF     │               │             │             │
  │               │                  │────────────────────────────────>│             │             │
  │               │                  │  invoice_cid    │               │             │             │
  │               │                  │<────────────────────────────────│             │             │
  │               │                  │                 │               │             │             │
  │               │                  │  setInvoiceCID  │               │             │             │
  │               │                  │  (orderId, cid) │               │             │             │
  │               │                  │  on-chain       │               │             │             │
  │               │                  │────────────────────────────────────────────────────────────>│
  │               │                  │                 │               │             │             │
  │               │                  │  Update DB:     │               │             │             │
  │               │                  │  ESCROWED       │               │             │             │
  │               │                  │                 │               │             │             │
  │               │                  │  Dispatch       │               │             │             │
  │               │                  │  webhook:       │               │             │             │
  │               │                  │  escrow.created │               │             │             │
  │               │                  │  → dev's URL    │               │             │             │
  │               │                  │                 │               │             │             │
  │               │                  │  Push via       │               │             │             │
  │               │                  │  WebSocket:     │               │             │             │
  │               │                  │  seller notified│               │             │             │
  │               │                  │                 │               │             │             │
  │               │  { status:       │                 │               │             │             │
  │               │    ESCROWED,     │                 │               │             │             │
  │               │    invoice_cid,  │                 │               │             │             │
  │               │    payout_sched  │                 │               │             │             │
  │               │    ule }         │                 │               │             │             │
  │               │<─────────────────│                 │               │             │             │
  │               │                  │                 │               │             │             │
  │  "Payment     │                  │                 │               │             │             │
  │   secured!    │                  │                 │               │             │             │
  │   Seller      │                  │                 │               │             │             │
  │   will ship   │                  │                 │               │             │             │
  │   soon."      │                  │                 │               │             │             │
  │  [View Order] │                  │                 │               │             │             │
  │<──────────────│                  │                 │               │             │             │
  │               │                  │                 │               │             │             │
  │  onComplete() │                  │                 │               │             │             │
  │  callback     │                  │                 │               │             │             │
  │  fires →      │                  │                 │               │             │             │
  │  redirect to  │                  │                 │               │             │             │
  │  /orders/:id  │                  │                 │               │             │             │
```

**Step 3: Automatic Shipping Progression (no buyer action needed)**

```plain
Carrier          Shippo           Backend API          Pinata        EscrowFSM     Splitter     Seller Wallet    Buyer (passive)
  │                │                   │                  │              │             │              │               │
  │ First scan:    │                   │                  │              │             │              │               │
  │ "Accepted at   │                   │                  │              │             │              │               │
  │  Austin, TX"   │                   │                  │              │             │              │               │
  │───────────────>│                   │                  │              │             │              │               │
  │                │  POST /shipping/  │                  │              │             │              │               │
  │                │  webhook/shippo   │                  │              │             │              │               │
  │                │  { tracking_#,    │                  │              │             │              │               │
  │                │    status:TRANSIT}│                  │              │             │              │               │
  │                │──────────────────>│                  │              │             │              │               │
  │                │                   │                  │              │             │              │               │
  │                │                   │  Lookup order by │              │             │              │               │
  │                │                   │  tracking_#      │              │             │              │               │
  │                │                   │  Verify state =  │              │             │              │               │
  │                │                   │  LABEL_CREATED   │              │             │              │               │
  │                │                   │                  │              │             │              │               │
  │                │                   │  Pin transit     │              │             │              │               │
  │                │                   │  proof JSON      │              │             │              │               │
  │                │                   │─────────────────>│              │             │              │               │
  │                │                   │  proof_cid       │              │             │              │               │
  │                │                   │<─────────────────│              │             │              │               │
  │                │                   │                  │              │             │              │               │
  │                │                   │  advanceState    │              │             │              │               │
  │                │                   │  (id, SHIPPED,   │              │             │              │               │
  │                │                   │   proof_cid)     │              │             │              │               │
  │                │                   │────────────────────────────────>│             │              │               │
  │                │                   │                  │              │             │              │               │
  │                │                   │                  │  LABEL →     │             │              │               │
  │                │                   │                  │  SHIPPED     │             │              │               │
  │                │                   │                  │  release 15% │             │              │               │
  │                │                   │                  │  ───────────>│             │              │               │
  │                │                   │                  │              │  6.83 FLUSD │              │               │
  │                │                   │                  │              │  ──────────>│              │               │
  │                │                   │                  │              │             │ tx confirmed │               │
  │                │                   │                  │              │             │              │               │
  │                │                   │  Webhook:        │              │             │              │               │
  │                │                   │  state.advanced  │              │             │              │               │
  │                │                   │ + payout.released│              │             │              │               │
  │                │                   │                  │              │             │              │               │
  │                │                   │  WebSocket push  │              │             │              │               │
  │                │                   │  → OrderTracker  │              │             │              │               │
  │                │                   │  updates in      │              │             │              │               │
  │                │                   │  real-time       │              │             │              │               │
  │                │                   │─────────────────────────────────────────────────────────────────────────────>│
  │                │                   │                  │              │             │              │  "Shipped!    │
  │                │                   │                  │              │             │              │  From Austin" │
  │                │                   │                  │              │             │              │               │
  │ In transit:    │                   │                  │              │             │              │               │
  │ "Dallas, TX"   │                   │                  │              │             │              │               │
  │───────────────>│                   │                  │              │             │              │               │
  │                │  (same flow)      │                  │              │             │              │               │
  │                │  SHIPPED →        │                  │              │             │              │               │
  │                │  IN_TRANSIT       │                  │              │             │              │               │
  │                │  release 20%      │                  │              │             │              │               │
  │                │  (9.10 FLUSD)     │                  │              │             │              │               │
  │                │─────────────────────────────────────────────────────────────────────────────────────────────────>│
  │                │                   │                  │              │             │              │  "In transit  │
  │                │                   │                  │              │             │              │  Dallas, TX"  │
  │                │                   │                  │              │             │              │               │
  │ Delivered:     │                   │                  │              │             │              │               │
  │ "Signed:       │                   │                  │              │             │              │               │
  │  JANE DOE"     │                   │                  │              │             │              │               │
  │───────────────>│                   │                  │              │             │              │               │
  │                │  (same flow)      │                  │              │             │              │               │
  │                │  IN_TRANSIT →     │                  │              │             │              │               │
  │                │  DELIVERED        │                  │              │             │              │               │
  │                │  release 35%      │                  │              │             │              │               │
  │                │  (15.93 FLUSD)    │                  │              │             │              │               │
  │                │                   │                  │              │             │              │               │
  │                │  Start 48h        │                  │              │             │              │               │
  │                │  grace period     │                  │              │             │              │               │
  │                │─────────────────────────────────────────────────────────────────────────────────────────────────>│
  │                │                   │                  │              │             │              │  "Delivered!  │
  │                │                   │                  │              │             │              │  48h to       │
  │                │                   │                  │              │             │              │  inspect."    │
```

**Step 4: Grace Period → Finalization (happy path)**

```plain
Cron Job (48h)         Backend API         Pinata        EscrowFSM      Splitter    Seller Wallet   Platform Wallet
  │                        │                  │              │             │              │              │
  │  Timer fires:          │                  │              │             │              │              │
  │  grace period expired  │                  │              │             │              │              │
  │  for order sf_ord_...  │                  │              │             │              │              │
  │───────────────────────>│                  │              │             │              │              │
  │                        │                  │              │             │              │              │
  │                        │  Check: no       │              │             │              │              │
  │                        │  active disputes │              │             │              │              │
  │                        │  for this order  │              │             │              │              │
  │                        │                  │              │             │              │              │
  │                        │  Pin finalization│              │             │              │              │
  │                        │  receipt JSON    │              │             │              │              │
  │                        │─────────────────>│              │             │              │              │
  │                        │  receipt_cid     │              │             │              │              │
  │                        │<─────────────────│              │             │              │              │
  │                        │                  │              │             │              │              │
  │                        │  finalize(       │              │             │              │              │
  │                        │   orderId,       │              │             │              │              │
  │                        │   receipt_cid)   │              │             │              │              │
  │                        │────────────────────────────────>│             │              │              │
  │                        │                  │              │             │              │              │
  │                        │                  │  DELIVERED   │             │              │              │
  │                        │                  │  → FINALIZED │             │              │              │
  │                        │                  │              │             │              │              │
  │                        │                  │  releaseFinal│             │              │              │
  │                        │                  │  (id, 15%)   │             │              │              │
  │                        │                  │  ───────────>│             │              │              │
  │                        │                  │              │             │              │              │
  │                        │                  │              │  Gross:     │              │              │
  │                        │                  │              │  6.83 FLUSD │              │              │
  │                        │                  │              │             │              │              │
  │                        │                  │              │  Deduct 2.5%│              │              │
  │                        │                  │              │  = 1.14     │              │              │
  │                        │                  │              │             │              │              │
  │                        │                  │              │  5.69 FLUSD │              │              │
  │                        │                  │              │  → seller   │              │              │
  │                        │                  │              │  ─────────────────────────>│              │
  │                        │                  │              │             │              │              │
  │                        │                  │              │  1.14 FLUSD │              │              │
  │                        │                  │              │  → platform │              │              │
  │                        │                  │              │  ────────────────────────────────────────>│
  │                        │                  │              │             │              │              │
  │                        │  Webhook:        │              │             │              │              │
  │                        │  order.finalized │              │             │              │              │
  │                        │  + payout.final  │              │             │              │              │
  │                        │                  │              │             │              │              │
  │                        │  Total to seller │              │             │              │              │
  │                        │  across all      │              │             │              │              │
  │                        │  payouts: 44.38  │              │             │              │              │
  │                        │  Platform fee:   │              │             │              │              │
  │                        │  1.14            │              │             │              │              │
```

---

### WORKFLOW 4: BUYER — Dispute Filing via AI Agent

```plain
Buyer            BuyerChat Widget     Backend API       BuyerAgent (OpenClaw)      Pinata IPFS    EscrowFSM    DisputeResolver
  │                   │                    │                    │                       │             │              │
  │  "The headphones  │                    │                    │                       │             │              │
  │   are wrong color │                    │                    │                       │             │              │
  │   and scratched"  │                    │                    │                       │             │              │
  │──────────────────>│                    │                    │                       │             │              │
  │                   │                    │                    │                       │             │              │
  │                   │  POST /agents/chat │                    │                       │             │              │
  │                   │  { role: "buyer",  │                    │                       │             │              │
  │                   │    user_id: wallet,│                    │                       │             │              │
  │                   │    message: "..." }│                    │                       │             │              │
  │                   │───────────────────>│                    │                       │             │              │
  │                   │                    │                    │                       │             │              │
  │                   │                    │  Route to          │                       │             │              │
  │                   │                    │  BuyerAgent on     │                       │             │              │
  │                   │                    │  Pinata            │                       │             │              │
  │                   │                    │  (HTTPS to agent   │                       │             │              │
  │                   │                    │   gateway URL)     │                       │             │              │
  │                   │                    │───────────────────>│                       │             │              │
  │                   │                    │                    │                       │             │              │
  │                   │                    │                    │  Nemotron (via        │             │              │
  │                   │                    │                    │  OpenRouter) detects  │             │              │
  │                   │                    │                    │  dispute intent       │             │              │
  │                   │                    │                    │                       │             │              │
  │                   │                    │                    │  TOOL CALL:           │             │              │
  │                   │                    │                    │  order-status skill   │             │              │
  │                   │                    │                    │  → GET /orders/:id    │             │              │
  │                   │                    │                    │  using FLOWSTATE_     │             │              │
  │                   │                    │                    │  API_KEY from         │             │              │
  │                   │                    │                    │  Pinata Secrets       │             │              │
  │                   │                    │                    │──────────────────────>│             │              │
  │                   │                    │                    │  (skill makes HTTP    │             │              │
  │                   │                    │                    │   call to backend)    │             │              │
  │                   │                    │                    │                       │             │              │
  │                   │                    │                    │  Order is DELIVERED,  │             │              │
  │                   │                    │                    │  grace period active. │             │              │
  │                   │                    │                    │  Dispute is valid.    │             │              │
  │                   │                    │                    │<──────────────────────│             │              │
  │                   │                    │                    │                       │             │              │
  │                   │                    │  "I can help file  │                       │             │              │
  │                   │                    │   a dispute.       │                       │             │              │
  │                   │                    │   Upload photos."  │                       │             │              │
  │                   │                    │<───────────────────│                       │             │              │
  │                   │                    │                    │                       │             │              │
  │                   │  Agent response    │                    │                       │             │              │
  │                   │<───────────────────│                    │                       │             │              │
  │                   │                    │                    │                       │             │              │
  │  "Upload photos   │                    │                    │                       │             │              │
  │   of the issue."  │                    │                    │                       │             │              │
  │<──────────────────│                    │                    │                       │             │              │
  │                   │                    │                    │                       │             │              │
  │  [Uploads 2 imgs] │                    │                    │                       │             │              │
  │  "Confirm dispute"│                    │                    │                       │             │              │
  │──────────────────>│                    │                    │                       │             │              │
  │                   │  POST /agents/chat │                    │                       │             │              │
  │                   │  { message:        │                    │                       │             │              │
  │                   │    "confirm",      │                    │                       │             │              │
  │                   │    evidence:       │                    │                       │             │              │
  │                   │    [img1, img2] }  │                    │                       │             │              │
  │                   │───────────────────>│                    │                       │             │              │
  │                   │                    │───────────────────>│                       │             │              │
  │                   │                    │                    │                       │             │              │
  │                   │                    │                    │  TOOL CALL:           │             │              │
  │                   │                    │                    │  file-dispute skill   │             │              │
  │                   │                    │                    │  → POST /disputes/    │             │              │
  │                   │                    │                    │    create             │             │              │
  │                   │                    │                    │  { order_id, reason:  │             │              │
  │                   │                    │                    │    ITEM_NOT_AS_DESC,  │             │              │
  │                   │                    │                    │    evidence: [...] }  │             │              │
  │                   │                    │                    │──────────────────────>│             │              │
  │                   │                    │                    │                       │             │              │
  │                   │                    │ (Backend processes │                       │             │              │
  │                   │                    │  dispute creation) │                       │             │              │
  │                   │                    │                    │                       │             │              │
  │                   │                    │  Pin evidence img1 │                       │             │              │
  │                   │                    │───────────────────────────────────────────>│             │              │
  │                   │                    │  cid_1             │                       │             │              │
  │                   │                    │<───────────────────────────────────────────│             │              │
  │                   │                    │  Pin evidence img2 │                       │             │              │
  │                   │                    │───────────────────────────────────────────>│             │              │
  │                   │                    │  cid_2             │                       │             │              │
  │                   │                    │<───────────────────────────────────────────│             │              │
  │                   │                    │  Pin dispute       │                       │             │              │
  │                   │                    │  summary JSON      │                       │             │              │
  │                   │                    │───────────────────────────────────────────>│             │              │
  │                   │                    │  summary_cid       │                       │             │              │
  │                   │                    │<───────────────────────────────────────────│             │              │
  │                   │                    │                    │                       │             │              │
  │                   │                    │  initiateDispute   │                       │             │              │
  │                   │                    │  (orderId)         │                       │             │              │
  │                   │                    │─────────────────────────────────────────────────────────>│              │
  │                   │                    │                    │                       │  DELIVERED  │              │
  │                   │                    │                    │                       │  → DISPUTED │              │
  │                   │                    │                    │                       │  Freeze     │              │
  │                   │                    │                    │                       │  remaining  │              │
  │                   │                    │                    │                       │  6.83 FLUSD │              │
  │                   │                    │                    │                       │             │              │
  │                   │                    │  createDispute     │                       │             │              │
  │                   │                    │  (orderId,         │                       │             │              │
  │                   │                    │   summary_cid)     │                       │             │              │
  │                   │                    │────────────────────────────────────────────────────────────────────────>│
  │                   │                    │                    │                       │             │  Start 72h   │
  │                   │                    │                    │                       │             │  seller      │
  │                   │                    │                    │                       │             │  timer       │
  │                   │                    │                    │                       │             │              │
  │                   │                    │  Webhook:          │                       │             │              │
  │                   │                    │  dispute.created   │                       │             │              │
  │                   │                    │                    │                       │             │              │
  │                   │                    │  { dispute_id,     │                       │             │              │
  │                   │                    │    frozen: 6.83,   │                       │             │              │
  │                   │                    │    deadline:       │                       │             │              │
  │                   │                    │    72h from now }  │                       │             │              │
  │                   │                    │<────────────────────────────────────────────────────────────────────────│
  │                   │                    │                    │                       │             │              │
  │                   │                    │───────────────────>│                       │             │              │
  │                   │                    │                    │                       │             │              │
  │                   │                    │                    │  "Dispute filed!      │             │              │
  │                   │                    │                    │   6.83 FLUSD frozen.  │             │              │
  │                   │                    │                    │   Seller has 72h to   │             │              │
  │                   │                    │                    │   respond. Evidence   │             │              │
  │                   │                    │                    │   stored on IPFS."    │             │              │
  │                   │                    │<───────────────────│                       │             │              │
  │                   │                    │                    │                       │             │              │
  │                   │  Agent response    │                    │                       │             │              │
  │                   │<───────────────────│                    │                       │             │              │
  │                   │                    │                    │                       │             │              │
  │  "Dispute filed!  │                    │                    │                       │             │              │
  │   Tracking ID:    │                    │                    │                       │             │              │
  │   fs_dsp_abc789"  │                    │                    │                       │             │              │
  │<──────────────────│                    │                    │                       │             │              │
```

---

### WORKFLOW 5: ADMIN — Setup, Dashboard & Agent Usage

**Adding an Admin**

```plain
Developer            Flow State Website         Backend API
  │                       │                         │
  │  Go to project        │                         │
  │  settings, "Team"     │                         │
  │──────────────────────>│                         │
  │                       │                         │
  │  Add admin:           │                         │
  │  email + wallet       │                         │
  │  address              │                         │
  │──────────────────────>│                         │
  │                       │  POST /platform/        │
  │                       │  :projectId/admins      │
  │                       │  { email, wallet,       │
  │                       │    role: "admin" }      │
  │                       │────────────────────────>│
  │                       │                         │
  │                       │  Generate admin token   │
  │                       │  Send invite email      │
  │                       │                         │
  │                       │  { admin_id, token }    │
  │                       │<────────────────────────│
  │                       │                         │
  │  Admin invited.       │                         │
  │<──────────────────────│                         │
```

**Admin: Connecting Wallet & Viewing Dashboard**

```plain
Admin               Demo Store (/admin)      AdminDashboard          Backend API          AdminAgent (OpenClaw)
  │                       │                       │                       │                       │
  │  Visit /admin         │                       │                       │                       │
  │──────────────────────>│                       │                       │                       │
  │                       │                       │                       │                       │
  │  "Connect Wallet"     │                       │                       │                       │
  │  (same RainbowKit     │                       │                       │                       │
  │   flow as buyer/      │                       │                       │                       │
  │   seller)             │                       │                       │                       │
  │  MetaMask → XRPL EVM  │                       │                       │                       │
  │  Testnet, 0xAdmin...  │                       │                       │                       │
  │──────────────────────>│                       │                       │                       │
  │                       │                       │                       │                       │
  │                       │  <AdminDashboard      │                       │                       │
  │                       │   projectId=          │                       │                       │
  │                       │   "fs_proj_abc123" /> │                       │                       │
  │                       │──────────────────────>│                       │                       │
  │                       │                       │                       │                       │
  │                       │                       │  GET /platform/       │                       │
  │                       │                       │  :projectId/analytics │                       │
  │                       │                       │  ?period=7d           │                       │
  │                       │                       │──────────────────────>│                       │
  │                       │                       │                       │                       │
  │                       │                       │  { orders: {total:    │                       │
  │                       │                       │    340, by_status},   │                       │
  │                       │                       │    volume: {...},     │                       │
  │                       │                       │    disputes: {...},   │                       │
  │                       │                       │    sellers: {...},    │                       │
  │                       │                       │    agents: {...},     │                       │
  │                       │                       │    on_chain: {...} }  │                       │
  │                       │                       │<──────────────────────│                       │
  │                       │                       │                       │                       │
  │  Dashboard renders:   │                       │                       │                       │
  │  - Order volume chart │                       │                       │                       │
  │  - Revenue chart      │                       │                       │                       │
  │  - Dispute rate       │                       │                       │                       │
  │  - Active sellers     │                       │                       │                       │
  │  - Gas costs          │                       │                       │                       │
  │  - Agent chat panel   │                       │                       │                       │
  │<──────────────────────│                       │                       │                       │
  │                       │                       │                       │                       │
  │  Types in agent chat: │                       │                       │                       │
  │  "Which sellers have  │                       │                       │                       │
  │   high dispute rates?"│                       │                       │                       │
  │──────────────────────>│                       │                       │                       │
  │                       │                       │  POST /agents/chat    │                       │
  │                       │                       │  { role: "admin",     │                       │
  │                       │                       │    message: "..." }   │                       │
  │                       │                       │──────────────────────>│                       │
  │                       │                       │                       │                       │
  │                       │                       │                       │  Route to AdminAgent  │
  │                       │                       │                       │  on Pinata            │
  │                       │                       │                       │──────────────────────>│
  │                       │                       │                       │                       │
  │                       │                       │                       │  Nemotron detects     │
  │                       │                       │                       │  intent: flagged      │
  │                       │                       │                       │  sellers              │
  │                       │                       │                       │                       │
  │                       │                       │                       │  TOOL CALL:           │
  │                       │                       │                       │  flagged-sellers      │
  │                       │                       │                       │  skill                │
  │                       │                       │                       │  → GET /platform/     │
  │                       │                       │                       │  :id/sellers?         │
  │                       │                       │                       │  flagged=true         │
  │                       │                       │                       │  (uses FLOWSTATE_     │
  │                       │                       │                       │   API_KEY secret)     │
  │                       │                       │                       │<──────────────────────│
  │                       │                       │                       │                       │
  │                       │                       │                       │  Returns: [           │
  │                       │                       │                       │   { seller: QuickShip,│
  │                       │                       │                       │     dispute_rate:     │
  │                       │                       │                       │     8.2% }            │
  │                       │                       │                       │  ]                    │
  │                       │                       │                       │──────────────────────>│
  │                       │                       │                       │                       │
  │                       │                       │                       │  Nemotron formats     │
  │                       │                       │                       │  response with        │
  │                       │                       │                       │  context and          │
  │                       │                       │                       │  recommendations      │
  │                       │                       │                       │                       │
  │                       │                       │                       │<──────────────────────│
  │                       │                       │                       │                       │
  │                       │                       │  "QuickShip has an    │                       │
  │                       │                       │   8.2% dispute rate   │                       │
  │                       │                       │   (well above the     │                       │
  │                       │                       │   2.4% platform avg). │                       │
  │                       │                       │   Consider reviewing  │                       │
  │                       │                       │   their last 10       │                       │
  │                       │                       │   orders."            │                       │
  │                       │                       │<──────────────────────│                       │
  │                       │                       │                       │                       │
  │  Agent response shown │                       │                       │                       │
  │  in chat panel        │                       │                       │                       │
  │<──────────────────────│                       │                       │                       │
```

---

### WORKFLOW 6: SELLER — Using the AI Agent

```plain
Seller           SellerDashboard         Backend API         SellerAgent (OpenClaw)
  │                   │                       │                       │
  │  In chat panel:   │                       │                       │
  │  "What's my       │                       │                       │
  │   dispute rate    │                       │                       │
  │   this month?"    │                       │                       │
  │──────────────────>│                       │                       │
  │                   │  POST /agents/chat    │                       │
  │                   │  { role: "seller",    │                       │
  │                   │    user_id: seller_id,│                       │
  │                   │    message: "..." }   │                       │
  │                   │──────────────────────>│                       │
  │                   │                       │  Route to SellerAgent │
  │                   │                       │──────────────────────>│
  │                   │                       │                       │
  │                   │                       │  TOOL CALL:           │
  │                   │                       │  get-metrics skill    │
  │                   │                       │  → GET /sellers/      │
  │                   │                       │  :id/metrics?         │
  │                   │                       │  period=30d           │
  │                   │                       │                       │
  │                   │                       │  Returns: {           │
  │                   │                       │   disputes: 2,        │
  │                   │                       │   total: 89,          │
  │                   │                       │   rate: 0.022,        │
  │                   │                       │   both resolved in    │
  │                   │                       │   seller favor,       │
  │                   │                       │   reputation: 96 }    │
  │                   │                       │                       │
  │                   │                       │  Nemotron formats:    │
  │                   │                       │  "Your dispute rate   │
  │                   │                       │   is 2.2% (2 of 89    │
  │                   │                       │   orders). Both       │
  │                   │                       │   resolved in your    │
  │                   │                       │   favor. Reputation   │
  │                   │                       │   score: 96/100."     │
  │                   │                       │<──────────────────────│
  │                   │                       │                       │
  │                   │  Agent response       │                       │
  │                   │<──────────────────────│                       │
  │                   │                       │                       │
  │  "2.2%, both in   │                       │                       │
  │   my favor,       │                       │                       │
  │   score 96."      │                       │                       │
  │<──────────────────│                       │                       │
  │                   │                       │                       │
  │  "Can you confirm │                       │                       │
  │   that I printed  │                       │                       │
  │   label for order │                       │                       │
  │   sf_ord_new123?" │                       │                       │
  │──────────────────>│                       │                       │
  │                   │  POST /agents/chat    │                       │
  │                   │──────────────────────>│                       │
  │                   │                       │──────────────────────>│
  │                   │                       │                       │
  │                   │                       │  TOOL CALL:           │
  │                   │                       │  confirm-label skill  │
  │                   │                       │  → POST /orders/      │
  │                   │                       │  sf_ord_new123/       │
  │                   │                       │  confirm-label-printed│
  │                   │                       │  { seller_wallet }    │
  │                   │                       │                       │
  │                   │                       │  (Backend processes:  │
  │                   │                       │   pin receipt,        │
  │                   │                       │   advance state,      │
  │                   │                       │   release 15%)        │
  │                   │                       │                       │
  │                   │                       │  Returns: {           │
  │                   │                       │   status: LABEL_      │
  │                   │                       │   CREATED,            │
  │                   │                       │   payout: 6.83 }      │
  │                   │                       │                       │
  │                   │                       │  "Done! Label         │
  │                   │                       │   confirmed for       │
  │                   │                       │   sf_ord_new123.      │
  │                   │                       │   6.83 FLUSD released │
  │                   │                       │   to your wallet."    │
  │                   │                       │<──────────────────────│
  │                   │                       │                       │
  │  Agent confirmed  │                       │                       │
  │  label + payout!  │                       │                       │
  │<──────────────────│                       │                       │
```

---

### WORKFLOW 7: DISPUTE — Seller Response & Resolution

```plain
Seller          SellerDashboard      Backend API          Pinata       DisputeResolver     EscrowFSM    Buyer Wallet
  │                   │                   │                  │               │                │              │
  │  Notification:    │                   │                  │               │                │              │
  │  "New dispute on  │                   │                  │               │                │              │
  │   order 7f8a9b2c" │                   │                  │               │                │              │
  │<──────────────────│                   │                  │               │                │              │
  │                   │                   │                  │               │                │              │
  │  View dispute     │                   │                  │               │                │              │
  │  details          │                   │                  │               │                │              │
  │──────────────────>│                   │                  │               │                │              │
  │                   │  GET /disputes/   │                  │               │                │              │
  │                   │  fs_dsp_abc789    │                  │               │                │              │
  │                   │──────────────────>│                  │               │                │              │
  │                   │                   │                  │               │                │              │
  │  See: buyer's     │                   │                  │               │                │              │
  │  photos + reason  │                   │                  │               │                │              │
  │  (fetched from    │                   │                  │               │                │              │
  │   IPFS via CIDs)  │                   │                  │               │                │              │
  │<──────────────────│                   │                  │               │                │              │
  │                   │                   │                  │               │                │              │
  │                   │                   │                  │               │                │              │
  │  PATH A: Accept   │                   │                  │               │                │              │
  │  ─────────────────│                   │                  │               │                │              │
  │  Click "Accept    │                   │                  │               │                │              │
  │  & Refund"        │                   │                  │               │                │              │
  │──────────────────>│                   │                  │               │                │              │
  │                   │  POST /disputes/  │                  │               │                │              │
  │                   │  :id/respond      │                  │               │                │              │
  │                   │  { action: ACCEPT}│                  │               │                │              │
  │                   │──────────────────>│                  │               │                │              │
  │                   │                   │  resolve(id,     │               │                │              │
  │                   │                   │   REFUND_BUYER)  │               │                │              │
  │                   │                   │────────────────────────────────> │                │              │
  │                   │                   │                  │               │                │              │
  │                   │                   │                  │               │  refundBuyer   │              │
  │                   │                   │                  │               │  (id, 6.83)    │              │
  │                   │                   │                  │               │───────────────>│              │
  │                   │                   │                  │               │                │  6.83 FLUSD  │
  │                   │                   │                  │               │                │  → buyer     │
  │                   │                   │                  │               │                │─────────────>│
  │                   │                   │                  │               │                │              │
  │                   │                   │                  │               │                │              │
  │  PATH B: Contest  │                   │                  │               │                │              │
  │  ─────────────────│                   │                  │               │                │              │
  │  Upload counter-  │                   │                  │               │                │              │
  │  evidence         │                   │                  │               │                │              │
  │──────────────────>│                   │                  │               │                │              │
  │                   │  POST /disputes/  │                  │               │                │              │
  │                   │  :id/respond      │                  │               │                │              │
  │                   │  { action: CONTEST│                  │               │                │              │
  │                   │    evidence:[...]}│                  │               │                │              │
  │                   │──────────────────>│                  │               │                │              │
  │                   │                   │  Pin seller      │               │                │              │
  │                   │                   │  evidence        │               │                │              │
  │                   │                   │─────────────────>│               │                │              │
  │                   │                   │  seller_evid_cid │               │                │              │
  │                   │                   │<─────────────────│               │                │              │
  │                   │                   │                  │               │                │              │
  │                   │                   │  respondToDispute│               │                │              │
  │                   │                   │  (id,            │               │                │              │
  │                   │                   │   seller_cid)    │               │                │              │
  │                   │                   │─────────────────────────────────>│                │              │
  │                   │                   │                  │  UNDER_REVIEW │                │              │
  │                   │                   │                  │  7-day window │                │              │
  │                   │                   │                  │               │                │              │
  │                   │                   │                  │               │                │              │
  │  PATH C: Timeout  │                   │                  │               │                │              │
  │  ─────────────────│                   │                  │               │                │              │
  │  (seller does     │                   │                  │               │                │              │
  │   nothing for 72h)│                   │                  │               │                │              │
  │                   │                   │                  │               │                │              │
  │       Cron (72h)──────────────────────>  autoResolve(id) │               │                │              │
  │                   │                   │─────────────────────────────────>│                │              │
  │                   │                   │                  │               │  Auto-refund   │              │
  │                   │                   │                  │               │  6.83 → buyer  │              │
  │                   │                   │                  │               │───────────────>│              │
  │                   │                   │                  │               │                │─────────────>│
```

---

### WORKFLOW 8: DEVELOPER — Receiving & Processing Webhooks

```plain
Backend API              HTTP POST               Developer's Server           Developer's DB
  │                         │                         │                           │
  │  Event occurs:          │                         │                           │
  │  e.g. state.advanced    │                         │                           │
  │                         │                         │                           │
  │  Build payload:         │                         │                           │
  │  { webhook_id,          │                         │                           │
  │    event: "state.       │                         │                           │
  │    advanced",           │                         │                           │
  │    data: { order_id,    │                         │                           │
  │    from: SHIPPED,       │                         │                           │
  │    to: IN_TRANSIT,      │                         │                           │
  │    payout: 9.10,        │                         │                           │
  │    tx_hash } }          │                         │                           │
  │                         │                         │                           │
  │  Sign with HMAC-SHA256  │                         │                           │
  │  using webhook secret   │                         │                           │
  │                         │                         │                           │
  │  POST to dev's URL      │                         │                           │
  │  x-flowstate-signature: │                         │                           │
  │  sha256=abc123...       │                         │                           │
  │────────────────────────>│                         │                           │
  │                         │                         │                           │
  │                         │  FlowStateServer.       │                           │
  │                         │  verifyAndParse(        │                           │
  │                         │   body, signature)      │                           │
  │                         │────────────────────────>│                           │
  │                         │                         │                           │
  │                         │                         │  Verify HMAC matches      │
  │                         │                         │  Parse JSON               │
  │                         │                         │  Return typed event       │
  │                         │                         │                           │
  │                         │                         │  switch(event.type):      │
  │                         │                         │  case "state.advanced":   │
  │                         │                         │    update local order     │
  │                         │                         │    status                 │
  │                         │                         │──────────────────────────>│
  │                         │                         │                           │
  │                         │                         │    send email to buyer    │
  │                         │                         │    "Your order shipped!"  │
  │                         │                         │                           │
  │                         │  return 200             │                           │
  │                         │<────────────────────────│                           │
  │                         │                         │                           │
  │  200 received.          │                         │                           │
  │  Mark webhook delivered.│                         │                           │
  │<────────────────────────│                         │                           │
  │                         │                         │                           │
  │  (If 4xx/5xx: retry     │                         │                           │
  │   with exponential      │                         │                           │
  │   backoff, up to 5x)    │                         │                           │
```

---

## Part 4: Technology Summary (Complete)

| Category            | Technology                                               | Used By                              |
| ------------------- | -------------------------------------------------------- | ------------------------------------ |
| **Frontend**        | Next.js 14, TypeScript, Tailwind, shadcn/ui, Zustand     | Demo store                           |
| **Wallet**          | RainbowKit, wagmi, viem                                  | PayButton, wallet connection         |
| **React**           | React 18+, recharts, WebSocket client                    | All client SDK components            |
| **Backend**         | Fastify, TypeScript, Node.js 20                          | Backend API                          |
| **Database**        | PostgreSQL (Neon), Drizzle ORM                           | Backend API                          |
| **Cache/Queue**     | Redis (Upstash), BullMQ                                  | Job processing, rate limiting        |
| **Smart Contracts** | Solidity 0.8.20, Hardhat, OpenZeppelin, ethers.js v6     | XRPL EVM Sidechain                   |
| **Blockchain**      | XRPL EVM Sidechain (testnet, chain 1449000)              | Settlement layer                     |
| **Token**           | Custom ERC-20 (MockRLUSD / FLUSD)                        | Payment token                        |
| **Shipping**        | Shippo Node SDK (sandbox)                                | Rate shopping, labels, tracking      |
| **File Storage**    | Pinata SDK → IPFS                                        | Invoices, labels, evidence, receipts |
| **AI Agents**       | Pinata Agents (OpenClaw), NVIDIA Nemotron via OpenRouter | Buyer/Seller/Admin chat              |
| **Agent Skills**    | SKILL.md + shell/Node scripts per skill                  | 15 skills across 3 agents            |
| **Auth**            | API keys (gateway), NextAuth.js (demo store)             | All API access                       |
| **Hosting**         | Vercel (frontend), Railway/Render (API)                  | Deployment                           |
| **CI/CD**           | GitHub Actions                                           | Testing + deployment                 |
