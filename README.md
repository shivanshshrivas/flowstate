# FlowState

**Blockchain-powered escrow payment gateway for e-commerce** built on the **XRPL EVM Sidechain** with **Pinata IPFS** for decentralized storage and **Pinata MCP + OpenClaw Agents** for AI-assisted workflows.

> Built for the Ripple x Pinata Hackathon

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Repository Structure](#repository-structure)
- [Smart Contracts (XRPL EVM Sidechain)](#smart-contracts-xrpl-evm-sidechain)
- [Pinata Integration](#pinata-integration)
  - [IPFS Storage Layer](#ipfs-storage-layer)
  - [Pinata MCP Server](#pinata-mcp-server)
  - [Pinata OpenClaw Agents](#pinata-openclaw-agents)
- [Backend API](#backend-api)
- [Demo Store (Next.js)](#demo-store-nextjs)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Deployed Contract Addresses](#deployed-contract-addresses)
- [Testing](#testing)
- [Tech Stack](#tech-stack)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Demo Store (Next.js 16)                      │
│  Product Listings · Checkout · Order Tracking · Seller Dashboard    │
│  RainbowKit + wagmi + viem  ·  shadcn/ui + Tailwind                │
└────────────────────────────────┬────────────────────────────────────┘
                                 │ REST / WebSocket
┌────────────────────────────────▼────────────────────────────────────┐
│                       Backend API (Fastify + TypeScript)             │
│                                                                     │
│  Routes: orders · shipping · disputes · sellers · platform · agents │
│  Bridges: blockchain (ethers.js) · shippo · pinata                  │
│  Services: order · shipping · dispute · payout · webhook · agent    │
│  Queue: BullMQ + Redis  ·  WS: real-time state updates             │
└───────┬──────────────┬──────────────┬──────────────┬───────────────┘
        │              │              │              │
        ▼              ▼              ▼              ▼
┌──────────────┐ ┌───────────┐ ┌───────────┐ ┌──────────────────────┐
│ XRPL EVM     │ │ Shippo    │ │ Pinata    │ │ Pinata Agents        │
│ Sidechain    │ │ Shipping  │ │ IPFS      │ │ (OpenClaw)           │
│              │ │           │ │           │ │                      │
│ EscrowFSM    │ │ Rates     │ │ Invoices  │ │ BuyerAgent           │
│ DisputeRes.  │ │ Labels    │ │ Labels    │ │ SellerAgent          │
│ FLUSD Token  │ │ Tracking  │ │ Evidence  │ │ AdminAgent           │
│              │ │ Webhooks  │ │ Receipts  │ │                      │
│ Chain: 1449k │ │           │ │           │ │ 15 Skills (IPFS)     │
│ Gas: XRP     │ │ Sandbox   │ │ SDK       │ │ Pinata MCP Server    │
└──────────────┘ └───────────┘ └───────────┘ └──────────────────────┘
```

---

## Repository Structure

```
flowstate/
├── packages/contracts/     # Solidity smart contracts (Hardhat 3, XRPL EVM Sidechain)
│   ├── contracts/
│   │   ├── FLUSD.sol                    # Mock RLUSD stablecoin (ERC-20, 6 decimals)
│   │   ├── EscrowStateMachine.sol       # 7-state escrow FSM with streaming payouts
│   │   ├── DisputeResolver.sol          # Dispute lifecycle + auto-resolve
│   │   └── interfaces/                  # IEscrowStateMachine.sol, IDisputeResolver.sol
│   ├── test/                            # Hardhat + Mocha + Chai test suites
│   ├── ignition/                        # Hardhat Ignition deployment modules
│   └── hardhat.config.ts               # XRPL EVM Testnet network config
│
├── backend/                # Fastify REST API (TypeScript)
│   └── src/
│       ├── routes/          # orders, shipping, disputes, sellers, platform, agents, auth
│       ├── services/        # Business logic per domain
│       ├── bridges/         # blockchain.bridge, shippo.bridge, pinata.bridge
│       ├── queue/           # BullMQ async job processing
│       ├── ws/              # WebSocket real-time order updates
│       ├── cron/            # Grace period finalization scheduler
│       └── config/          # Environment + app configuration
│
├── pinata/                 # Pinata IPFS SDK wrapper (CommonJS)
│   └── src/
│       ├── client.js        # PinataSDK initialization (JWT + gateway)
│       ├── invoices.js      # Pin invoice PDFs + JSON to IPFS
│       ├── labels.js        # Pin Shippo shipping labels to IPFS
│       ├── evidence.js      # Pin dispute evidence files + bundles
│       └── receipts.js      # Pin state transition + payout proof receipts
│
├── pinata-mcp/             # Pinata MCP (Model Context Protocol) chat client
│   ├── .mcp.json            # MCP server config for pinata-mcp
│   └── chat.js              # AI chat loop: MCP tools + getFileInsights (PDF/JSON)
│
├── pinata-agents/          # Pinata OpenClaw Agent definitions
│   ├── agents/              # System prompts (buyer-agent.md, seller-agent.md, admin-agent.md)
│   ├── skills/              # 15 skill packages (SKILL.md + index.js per skill)
│   │   ├── buyer/           # order-status, track-shipment, file-dispute, get-receipt, list-my-orders
│   │   ├── seller/          # list-orders, get-metrics, confirm-label, respond-dispute, get-payouts
│   │   └── admin/           # get-analytics, list-sellers, flagged-sellers, webhook-logs, gas-report
│   ├── CID.txt              # IPFS CIDs for uploaded skill packages
│   └── ws-test.js           # WebSocket test client for agents
│
├── mcp-agents/             # MCP server exposing agents via LangChain + @modelcontextprotocol/sdk
│   └── src/
│       ├── agents/          # buyer-agent.ts, seller-agent.ts, admin-agent.ts, base-agent.ts
│       ├── tools/           # buyer-tools.ts, seller-tools.ts, admin-tools.ts
│       ├── session/         # Session manager for per-user context
│       └── index.ts         # MCP server entrypoint
│
├── demo-store/             # Next.js 16 e-commerce storefront
│   └── src/app/
│       ├── page.tsx          # Product listings
│       ├── product/          # Product detail pages
│       ├── cart/             # Shopping cart
│       ├── orders/           # Order tracking
│       ├── seller/           # Seller dashboard
│       ├── admin/            # Admin dashboard
│       ├── faucet/           # FLUSD testnet token faucet
│       └── api/              # API routes (orders, products, sellers, faucet, webhooks)
│
├── shippo/                 # Shippo shipping SDK wrapper (CommonJS)
│   └── src/                 # Rate shopping, label generation, tracking
│
└── docs/
    └── project-breakdown.md  # Full architecture decisions document
```

---

## Smart Contracts (XRPL EVM Sidechain)

All contracts are written in **Solidity ^0.8.24**, compiled with **Hardhat 3**, and deployed to the **XRPL EVM Sidechain Testnet** (Chain ID: `1449000`).

### FLUSD.sol — Mock Stablecoin

A 6-decimal ERC-20 token simulating RLUSD on the XRPL EVM Sidechain. When RLUSD launches as an ERC-20 on XRPL EVM, FlowState requires only an address swap — zero code changes.

| Function | Description |
|----------|-------------|
| `faucet()` | Mints 50,000 FLUSD to caller (1-hour cooldown) |
| `mint(to, amount)` | Owner-only minting for test environments |
| `decimals()` | Returns `6` (matches RLUSD spec) |

### EscrowStateMachine.sol — Core Escrow FSM

The heart of FlowState. A **7-state finite state machine** that holds buyer funds in escrow and releases them incrementally as shipping milestones are confirmed.

**State Flow:**
```
ESCROWED → LABEL_CREATED → SHIPPED → IN_TRANSIT → DELIVERED → FINALIZED
                                                       ↕
                                                   DISPUTED
```

**Streaming Payout Schedule (basis points):**

| Transition | Payout | Cumulative |
|---|---|---|
| Escrow created | 15% to seller | 15% |
| Label created → Shipped | 15% to seller | 30% |
| Shipped → In Transit | 20% to seller | 50% |
| In Transit → Delivered | 35% to seller | 85% |
| Grace period → Finalized | 15% holdback (minus 2.5% platform fee) | 100% |

**Key Functions:**

| Function | Access | Description |
|----------|--------|-------------|
| `createEscrow(orderId, buyer, seller, token, amount, payoutBps)` | Operator | Transfers tokens from buyer, releases first 15% |
| `advanceState(escrowId)` | Operator | Moves FSM forward, triggers partial payout |
| `finalize(escrowId)` | Operator | Releases holdback after grace period (default 3 days) |
| `initiateDispute(escrowId, evidenceCid)` | Operator/DisputeResolver | Freezes remaining funds |
| `executeResolution(escrowId, refundBps)` | DisputeResolver | Splits frozen funds per resolution |

**Security:** ReentrancyGuard, Pausable, Ownable, SafeERC20, custom error types, configurable platform fee cap (10%).

### DisputeResolver.sol — Dispute Lifecycle

Manages the full dispute lifecycle with a **72-hour seller response window** and automatic buyer refund on timeout.

**Dispute States:** `OPEN → UNDER_REVIEW → RESOLVED`

**Outcomes:** `REFUND_BUYER` (100% refund) | `RELEASE_SELLER` (0% refund) | `SPLIT` (custom basis points)

| Function | Access | Description |
|----------|--------|-------------|
| `createDispute(escrowId, buyerEvidenceCid)` | Operator | Freezes escrow funds, starts 72h timer |
| `respondToDispute(disputeId, sellerEvidenceCid)` | Operator | Seller submits counter-evidence |
| `resolveDispute(disputeId, outcome, refundBps)` | Admin | Executes resolution on EscrowStateMachine |
| `autoResolve(disputeId)` | Anyone | Auto-refunds buyer if seller misses 72h window |

Evidence CIDs (buyer and seller) are stored on-chain and point to **Pinata IPFS** bundles containing files + metadata.

---

## Pinata Integration

Pinata is used across three layers: **IPFS storage**, **MCP server**, and **OpenClaw AI agents**.

### IPFS Storage Layer

The `pinata/` package wraps the Pinata SDK to pin structured data to IPFS. Every pinned object gets a CID that is stored in PostgreSQL and/or referenced on-chain.

| Module | What It Pins | Called By |
|--------|-------------|-----------|
| `invoices.js` | Invoice PDFs + JSON metadata | `POST /orders/:id/confirm-escrow` |
| `labels.js` | Shipping label PDFs (fetched from Shippo) | `POST /orders/:id/select-shipping` |
| `evidence.js` | Dispute evidence files + bundles | `POST /disputes/create`, `POST /disputes/:id/respond` |
| `receipts.js` | State transition proofs + payout receipts | Shipping webhooks, state advances |

**Data flow example (dispute evidence):**
```
Buyer uploads photos/PDFs
  → pinEvidenceFile() pins each file → returns CID per file
  → pinEvidenceBundle() pins a JSON manifest with all file CIDs
  → bundle CID passed to DisputeResolver.createDispute(escrowId, bundleCid)
  → CID stored on-chain permanently
  → Anyone can verify evidence via Pinata gateway: https://<gateway>/ipfs/<cid>
```

### Pinata MCP Server

The `pinata-mcp/` directory implements a **Model Context Protocol (MCP)** client that connects to the official `pinata-mcp` server via stdio transport.

**How it works:**
1. Spawns `npx pinata-mcp` as a child process (stdio transport)
2. Connects via `@modelcontextprotocol/sdk` client
3. Discovers all MCP tools from the Pinata server (file listing, searching, pinning, etc.)
4. Adds a custom `getFileInsights` tool that fetches files by CID and returns rich analysis:
   - **JSON files:** parsed structure, field names, types, record counts, sample values
   - **PDF files:** extracted text, page count, document metadata
5. Routes all tools to an LLM (NVIDIA Nemotron via OpenRouter) for natural language interaction

**Usage:**
```bash
cd pinata-mcp
npm install
# Set PINATA_JWT, GATEWAY_URL, NVIDIA_API_KEY, NVIDIA_BASE_URL, NVIDIA_MODEL in .env
npm run chat
```

**Example session:**
```
you: What files do I have pinned?
assistant: [calls searchFiles via MCP] You have 12 files pinned including
           invoices, shipping labels, and dispute evidence bundles...

you: What's inside that invoice?
assistant: [calls getFileInsights] This is a PDF invoice with 2 pages.
           It contains order #FS-00142 for buyer 0xf39F... totaling 150.00 FLUSD...
```

**MCP Server Config (`.mcp.json`):**
```json
{
  "mcpServers": {
    "pinata": {
      "command": "npx",
      "args": ["pinata-mcp"],
      "env": {
        "PINATA_JWT": "<your-jwt>",
        "GATEWAY_URL": "<your-gateway>.mypinata.cloud"
      }
    }
  }
}
```

### Pinata OpenClaw Agents

Three AI agents hosted on [agents.pinata.cloud](https://agents.pinata.cloud) power role-based chat interfaces. Each agent has 5 skills pinned to IPFS.

| Agent | Role | Skills |
|-------|------|--------|
| **BuyerAgent** | Shopping assistant | `order-status`, `track-shipment`, `file-dispute`, `get-receipt`, `list-my-orders` |
| **SellerAgent** | Operations assistant | `list-orders`, `get-metrics`, `confirm-label`, `respond-dispute`, `get-payouts` |
| **AdminAgent** | Platform analyst | `get-analytics`, `list-sellers`, `flagged-sellers`, `webhook-logs`, `gas-report` |

**Each skill is a folder pinned to IPFS:**
```
order-status/
├── SKILL.md       # Name, description, env var requirements (read by OpenClaw)
├── index.js       # HTTP calls to FlowState backend API
└── metadata.json  # Tool schema for LLM function calling
```

**Chat routing architecture:**
```
React Component (BuyerChat / SellerDashboard / AdminDashboard)
    ↓  POST /api/v1/agents/chat  { role, user_id, message }
FlowState Backend (agent.service.ts)
    ↓  POST to PINATA_{ROLE}_AGENT_URL
Pinata OpenClaw Container
    ↓  LLM (Nemotron) + skill scripts → FlowState API
    ↑  { response, suggested_actions }
Backend
    ↑  { success: true, data: { response, role, suggested_actions } }
React Component renders response
```

**Agent deployment:** See [pinata-agents/README.md](pinata-agents/README.md) and [pinata-agents/setup.md](pinata-agents/setup.md) for step-by-step Pinata agent setup.

**MCP Agents Server (`mcp-agents/`):**
An alternative MCP server implementation using `@modelcontextprotocol/sdk` + LangChain that exposes the same buyer/seller/admin agents as MCP tools. Includes session management and tool isolation per agent role.

---

## Backend API

**Runtime:** Node.js + Fastify + TypeScript
**Database:** PostgreSQL (via `postgres` tagged template driver)
**Queue:** BullMQ + Redis (async webhook processing, state transitions)
**Real-time:** WebSocket (live order status updates)

### API Routes

| Route | Description |
|-------|-------------|
| `POST /orders/create` | Create order, fetch Shippo rates, calculate escrow amount |
| `POST /orders/:id/select-shipping` | Purchase Shippo label, pin to IPFS, set escrow |
| `POST /orders/:id/confirm-escrow` | Verify on-chain tx, generate + pin invoice |
| `POST /orders/:id/confirm-label-printed` | Advance FSM, trigger 15% payout |
| `POST /orders/:id/finalize` | Release holdback after grace period |
| `POST /shipping/webhook/shippo` | Receive tracking updates, advance contract state |
| `GET /shipping/rates` | Shippo rate shopping |
| `POST /disputes/create` | Upload evidence to IPFS, call DisputeResolver |
| `POST /disputes/:id/respond` | Seller counter-evidence |
| `POST /sellers/onboard` | Register seller + wallet |
| `GET /sellers/:id/orders` | Seller order list |
| `GET /sellers/:id/metrics` | Seller performance data |
| `POST /agents/chat` | Route to Pinata OpenClaw agent by role |
| `GET /platform/:projectId/analytics` | Platform-wide metrics |

### Bridge Layer

| Bridge | Integration |
|--------|-------------|
| `blockchain.bridge.ts` | ethers.js v6 → XRPL EVM Sidechain contracts |
| `shippo.bridge.ts` | Shippo SDK → rate shopping, label gen, tracking |
| `pinata.bridge.ts` | Pinata IPFS wrapper → invoices, labels, evidence, receipts |

---

## Demo Store (Next.js)

A full e-commerce storefront built with **Next.js 16**, **React 19**, **Tailwind CSS**, and **shadcn/ui** that demonstrates the complete FlowState checkout flow.

**Wallet connection:** RainbowKit + wagmi + viem (MetaMask → XRPL EVM Testnet)

| Page | Description |
|------|-------------|
| `/` | Product listings |
| `/product/[id]` | Product detail + "Buy with FlowState" button |
| `/cart` | Shopping cart |
| `/orders` | Buyer order tracking (7-state FSM visualization) |
| `/seller` | Seller dashboard (orders, labels, payouts) |
| `/admin` | Admin dashboard (analytics, sellers, agents) |
| `/faucet` | FLUSD testnet token faucet |
| `/auth` | Wallet-based authentication |

---

## Getting Started

### Prerequisites

- Node.js v20+
- PostgreSQL
- Redis (for BullMQ)
- MetaMask (configured for XRPL EVM Testnet)

### 1. Clone and install

```bash
git clone https://github.com/<your-org>/flowstate.git
cd flowstate
```

### 2. Smart contracts

```bash
cd packages/contracts
npm install
cp .env.example .env
# Add XRPL_EVM_RPC and DEPLOYER_PRIVATE_KEY to .env

# Run tests
npx hardhat test

# Deploy to XRPL EVM Testnet
npx hardhat ignition deploy ignition/modules/FullDeploy.ts --network xrplEvmTestnet
```

### 3. Backend

```bash
cd backend
npm install
cp .env.example .env
# Configure all env vars (see Environment Variables section)
npm run dev
```

### 4. Pinata IPFS

```bash
cd pinata
npm install
# Set PINATA_JWT and PINATA_GATEWAY in .env
```

### 5. Pinata MCP Chat

```bash
cd pinata-mcp
npm install
# Set PINATA_JWT, GATEWAY_URL, NVIDIA_API_KEY, NVIDIA_BASE_URL, NVIDIA_MODEL in .env
npm run chat
```

### 6. Pinata Agents

See [pinata-agents/setup.md](pinata-agents/setup.md) for full deployment instructions:
1. Add secrets to Pinata Vault (`OPENROUTER_API_KEY`, `FLOWSTATE_API_KEY`, `FLOWSTATE_API_URL`)
2. Upload 15 skill folders to Pinata IPFS
3. Create 3 agents on [agents.pinata.cloud](https://agents.pinata.cloud)
4. Copy agent gateway URLs to backend `.env`

### 7. Demo Store

```bash
cd demo-store
npm install
cp .env.example .env
# Configure Supabase + backend URL
npm run dev
```

### XRPL EVM Testnet Configuration

Add this network to MetaMask:

| Field | Value |
|-------|-------|
| Network Name | XRPL EVM Testnet |
| RPC URL | `https://rpc.testnet.xrplevm.org` |
| Chain ID | `1449000` |
| Currency Symbol | XRP |
| Block Explorer | `https://explorer.testnet.xrplevm.org` |
| Faucet | `https://faucet.xrplevm.org` (90 XRP per request) |

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | Yes | Redis connection string (BullMQ) |
| `SHIPPO_KEY` | Yes | Shippo API key (sandbox mode) |
| `PINATA_JWT` | No | Pinata JWT for IPFS pinning |
| `PINATA_GATEWAY` | No | Pinata gateway subdomain |
| `XRPL_EVM_RPC` | Yes | `https://rpc.testnet.xrplevm.org` |
| `ESCROW_CONTRACT` | Yes | Deployed EscrowStateMachine address |
| `DISPUTE_CONTRACT` | Yes | Deployed DisputeResolver address |
| `FLUSD_CONTRACT` | Yes | Deployed FLUSD address |
| `OPERATOR_PRIVATE_KEY` | Yes | Backend operator wallet key |
| `PINATA_BUYER_AGENT_URL` | No | Buyer agent gateway URL |
| `PINATA_SELLER_AGENT_URL` | No | Seller agent gateway URL |
| `PINATA_ADMIN_AGENT_URL` | No | Admin agent gateway URL |

### Smart Contracts (`packages/contracts/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `XRPL_EVM_RPC` | Yes | XRPL EVM Testnet RPC endpoint |
| `DEPLOYER_PRIVATE_KEY` | Yes | Deployer wallet private key |

---

## Deployed Contract Addresses

**Network:** XRPL EVM Sidechain Testnet (Chain ID: `1449000`)

| Contract | Address |
|----------|---------|
| EscrowStateMachine | `0x33136ca845ace5a4f8CC032793AF22eC024B2ee3` |
| FLUSD | `0x257812213360Df9f3C19cAe9759B58cAcf39323d` |
| DisputeResolver | `0x9A2C9B4CE17eE3ffD5C3Db97a04009381f457731` |

Verify on explorer: `https://explorer.testnet.xrplevm.org/address/<address>`

---

## Testing

### Smart Contracts
```bash
cd packages/contracts
npx hardhat test
# Tests: FLUSD.test.ts, EscrowStateMachine.test.ts, DisputeResolver.test.ts
```

### Backend
```bash
cd backend
npx vitest run src/bridges src/routes src/queue src/cron src/ws
# 33 tests across bridges, routes, queue, cron, and WebSocket
```

### Shippo
```bash
cd shippo
npm test
# 23 tests covering rate shopping, label generation, tracking
```

### Pinata Agents
```bash
cd mcp-agents
npm test
# Tool isolation + agent security tests
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Blockchain** | XRPL EVM Sidechain (Solidity ^0.8.24, Hardhat 3, ethers.js v6) |
| **Token** | FLUSD — ERC-20 mock stablecoin (6 decimals, simulates RLUSD) |
| **Smart Contracts** | OpenZeppelin (ERC20, ReentrancyGuard, Pausable, Ownable, SafeERC20) |
| **IPFS** | Pinata SDK — invoices, labels, evidence, receipts |
| **AI/MCP** | Pinata MCP Server + @modelcontextprotocol/sdk |
| **AI Agents** | Pinata OpenClaw (3 agents, 15 skills, NVIDIA Nemotron via OpenRouter) |
| **Backend** | Fastify 4 + TypeScript + PostgreSQL + BullMQ + Redis |
| **Frontend** | Next.js 16 + React 19 + Tailwind CSS + shadcn/ui |
| **Wallet** | RainbowKit + wagmi + viem (MetaMask → XRPL EVM Testnet) |
| **Shipping** | Shippo SDK (sandbox mode — rates, labels, tracking webhooks) |
| **Auth** | Supabase (demo store) + API keys + JWT (backend) |

---

## License

MIT
