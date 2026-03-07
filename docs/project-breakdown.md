# Flow State — Complete Project Breakdown

## The Big Picture

You're building three things that ship as one:

1. **`@flowstate/gateway`** — an npm package developers install to get blockchain escrow checkout on their e-commerce platform
2. **A set of smart contracts** on XRPL EVM Sidechain that handle escrow, disputes, and payment splitting
3. **Three OpenClaw AI agents** (hosted via Pinata) for buyer, seller, and admin workflows
4. **A demo e-commerce storefront** that integrates `@flowstate/gateway` to showcase everything end-to-end

---

## Decision 1: Where Do the Smart Contracts Live?

You have three options on XRPL. Here's the honest breakdown:

### Option A: XRPL EVM Sidechain (Solidity) — RECOMMENDED

The XRPL EVM Sidechain launched on mainnet June 30, 2025. It's a Cosmos SDK chain with full EVM compatibility. You write Solidity, deploy with Hardhat/Remix, interact with MetaMask — the entire Ethereum tooling ecosystem works.

**Why this is the best choice for Flow State:**

- You need a 7-state escrow FSM with streaming payouts. That's complex conditional logic — exactly what Solidity smart contracts are designed for.
- The tooling is mature: Hardhat, OpenZeppelin, ethers.js, Remix. Massive ecosystem of tutorials, audited patterns, and libraries.
- Testnet is available with a faucet (up to 90 XRP per request). Testnet chain ID: `1449000`. RPC: `https://rpc.testnet.xrplevm.org` (or free endpoints from Grove/BuildInTheShade).
- XRP is the native gas token — gas costs are very low.
- You can deploy a custom ERC-20 token to simulate RLUSD. This is what the person you mentioned was suggesting, and it's the right call.

**Testnet endpoints:**

- HTTP RPC: `https://rpc.testnet.xrplevm.org`
- Alternative: `https://xrplevm-testnet.buildintheshade.com`
- Faucet: `https://faucet.xrplevm.org` (paste your 0x address, get 90 test XRP)
- Explorer: `https://explorer.testnet.xrplevm.org`
- Chain ID: `1449000`

### Option B: XRPL Native Escrow + Oracle (Crypto-Conditions)

XRPL has native escrow built into the ledger. It supports time-based release and crypto-condition-based release (PREIMAGE-SHA-256). An oracle generates a condition/fulfillment pair, the escrow is created with the condition, and the oracle releases the fulfillment when real-world conditions are met.

**The problem for Flow State:** Native escrow is binary — all or nothing. You can't do streaming payouts (15% at label printed, 15% at shipped, etc.) with a single escrow. You'd need to create 5 separate escrows per order, each with its own crypto-condition and oracle, and manage the coordination yourself. It's possible but extremely convoluted compared to a Solidity FSM.

**Where this IS useful:** As a fallback or simpler path for demonstrating XRPL-native functionality. If judges ask "why not use XRPL native escrow?" you can say: "We use the EVM sidechain for the complex state machine, but the oracle + crypto-conditions pattern is what inspired our architecture."

### Option C: XRPL WASM Smart Escrows (Rust) — NOT READY

The XLS-100 Smart Escrows proposal would let you attach WASM bytecode (written in Rust using `xrpl-wasm-stdlib`) to escrow objects. This is the most native approach — your escrow logic runs directly on XRPL L1.

**The problem:** This is still in development. The `xrpl-wasm-stdlib` library exists and the WASM devnet is available (`wasm.devnet.rippletest.net`), but the Smart Escrow amendment hasn't been enabled on any stable network. The tooling (Craft CLI from Ripple) is being actively developed. For a project you need to ship and demo, this is too experimental.

**Verdict: Go with XRPL EVM Sidechain + Solidity.** It's production-ready, has testnet infrastructure, and the tooling is battle-tested.

---

## Decision 2: Token Strategy (The RLUSD Question)

Your contact was right — RLUSD doesn't have a testnet faucet. RLUSD is a real stablecoin issued by Ripple, and there's no way to mint fake RLUSD on testnet.

**Solution: Deploy your own ERC-20 token called `MockRLUSD` (or `FLUSD` — Flow USD).**

This is standard practice for hackathons and demos. Here's why it's fine:

- All ERC-20 tokens use the same interface (`transfer`, `approve`, `transferFrom`, `balanceOf`). Your escrow contracts interact with the token through this interface.
- When RLUSD eventually lands as an ERC-20 on XRPL EVM, you literally just change one address in your config. Zero code changes.
- You control the supply, so you can mint test tokens to demo wallets freely.

The mock token contract is about 30 lines of Solidity (extend OpenZeppelin's ERC20).

---

## Decision 3: Oracle on XRPL

You mentioned "define Oracle on XRPL that can be read." XRPL has a native Price Oracle feature (requires the PriceOracle amendment). These are on-chain price feeds where trusted providers post asset prices.

**For Flow State, you'd use an oracle for:**

- USD → token conversion rates (so the checkout can show "$39.99 = 40.02 FLUSD")
- Potentially triggering escrow state changes based on external events

**However, for your MVP/demo:** You don't need an on-chain oracle. Your backend API can handle price conversion with a simple exchange rate lookup. The oracle pattern becomes valuable at scale when you need trustless, decentralized price feeds.

**What you SHOULD mention in your architecture:** "Our system is oracle-ready. XRPL's native Price Oracle can feed exchange rates directly to our contracts, and the crypto-conditions pattern can serve as a fallback escrow mechanism for simpler flows."

---

## The Complete Tech Stack

### Smart Contracts Layer

| Component | Technology                  | Purpose                                   |
| --------- | --------------------------- | ----------------------------------------- |
| Language  | Solidity (^0.8.20)          | Smart contract logic                      |
| Framework | Hardhat                     | Compile, test, deploy, verify             |
| Libraries | OpenZeppelin Contracts      | ERC-20, access control, reentrancy guards |
| Network   | XRPL EVM Sidechain Testnet  | Deployment target                         |
| Token     | Custom ERC-20 (`MockRLUSD`) | Simulates RLUSD for escrow payments       |
| Testing   | Hardhat + Chai + ethers.js  | Unit tests for all contract functions     |

**Contracts to write:**

1. **`MockRLUSD.sol`** — ERC-20 token with mint function for testing. ~30 lines.
2. **`EscrowStateMachine.sol`** — The core contract. 7-state FSM, streaming payouts, grace period timer, dispute branching. ~300-400 lines.
3. **`DisputeResolver.sol`** — Dispute lifecycle: create, respond, auto-resolve on timeout, execute resolution. ~200 lines.
4. **`PaymentSplitter.sol`** — Handles partial releases, platform fee deduction, refunds. ~150 lines.

### Backend API

| Component    | Technology                  | Purpose                                            |
| ------------ | --------------------------- | -------------------------------------------------- |
| Runtime      | Node.js (v20+)              | Server runtime                                     |
| Framework    | Express.js or Fastify       | REST API                                           |
| Language     | TypeScript                  | Type safety                                        |
| Database     | PostgreSQL                  | Orders, sellers, sessions                          |
| ORM          | Prisma or Drizzle           | Database access                                    |
| Blockchain   | ethers.js v6                | Contract interaction                               |
| Shipping     | Shippo API (sandbox)        | Rate shopping, label gen, tracking webhooks        |
| File Storage | Pinata SDK                  | IPFS pinning for invoices, labels, evidence        |
| Real-time    | WebSocket (ws) or Socket.io | Live order status updates                          |
| Auth         | API keys + JWT              | Platform and seller authentication                 |
| Queue        | BullMQ + Redis              | Async jobs (webhook processing, state transitions) |

**API endpoints (grouped):**

- **Orders:** create, select-shipping, confirm-escrow, confirm-label-printed, finalize
- **Shipping:** webhook receiver (from Shippo), rates lookup, tracking
- **Sellers:** onboard, list orders, metrics
- **Disputes:** create, respond, resolve
- **Platform:** analytics, webhook registration
- **Agents:** chat endpoint (routes to correct OpenClaw agent)

### Frontend — Demo E-Commerce Store

| Component  | Technology                | Purpose                            |
| ---------- | ------------------------- | ---------------------------------- |
| Framework  | Next.js 14+ (App Router)  | Full-stack React framework         |
| Styling    | Tailwind CSS              | Rapid UI development               |
| State      | Zustand or React Context  | Client-side state                  |
| Wallet     | RainbowKit + wagmi + viem | Wallet connection (MetaMask, etc.) |
| Components | shadcn/ui                 | Pre-built accessible components    |

**Pages to build:**

1. **Home / Product Listing** — Browse fake products
2. **Product Detail** — View item, click "Buy with Flow State"
3. **Checkout Overlay** — `<PayButton />` triggers this. Shows shipping options, wallet approval, escrow confirmation
4. **Order Tracking** — Real-time status with the 7-state visualization
5. **Seller Dashboard** — Orders list, print label, view payouts, metrics, AI chat
6. **Admin Dashboard** — Platform analytics, seller management, webhook logs, AI chat
7. **Buyer Chat** — Embedded AI agent for order queries and dispute filing

### Frontend — The `@flowstate/gateway` Package

This is the npm package that other developers would install. For your demo, the "other developer" is your own demo store.

**Package structure:**

```plain
@flowstate/gateway/
├── client/
│   ├── FlowStateProvider.tsx      # Config context
│   ├── PayButton.tsx              # The checkout button
│   ├── BuyerChat.tsx              # AI agent chat widget
│   ├── SellerDashboard.tsx        # Embeddable seller view
│   ├── AdminDashboard.tsx         # Embeddable admin view
│   └── OrderTracker.tsx           # Status widget
├── server/
│   ├── FlowStateServer.ts         # Webhook handler
│   ├── webhookVerifier.ts         # Signature verification
│   └── apiClient.ts              # Typed API client
├── contracts/                     # ABI JSON files
├── types/                         # TypeScript definitions
└── index.ts                       # Exports
```

### AI Agents (via Pinata OpenClaw)

| Component    | Technology                          | Purpose                           |
| ------------ | ----------------------------------- | --------------------------------- |
| Platform     | Pinata Agents (agents.pinata.cloud) | Hosted OpenClaw instances         |
| Framework    | OpenClaw                            | Autonomous agent runtime          |
| LLM Provider | Anthropic (Claude)                  | Reasoning engine                  |
| Skills       | Custom SKILL.md packages            | Domain-specific capabilities      |
| Channels     | Web chat (embedded in gateway)      | User-facing interface             |
| Secrets      | Pinata Secrets Vault                | API keys for LLM + Flow State API |

**Three agents to deploy:**

1. **BuyerAgent** — Personality: helpful shopping assistant
   - Skills: `order-status`, `track-shipment`, `file-dispute`, `get-receipt`, `search-products`
   - Each skill calls your Flow State API endpoints
   - Can autonomously file disputes with evidence

2. **SellerAgent** — Personality: data-driven operations assistant
   - Skills: `list-orders`, `get-metrics`, `confirm-label`, `respond-dispute`, `get-payouts`
   - Can autonomously confirm label printing, respond to disputes

3. **AdminAgent** — Personality: platform operations analyst
   - Skills: `get-analytics`, `list-sellers`, `webhook-logs`, `gas-report`, `flagged-sellers`
   - Can autonomously identify problematic sellers, generate reports

**How the agents connect to your system:**

Each OpenClaw skill is a folder with a `SKILL.md` file that describes what it does and a script that makes HTTP calls to your Flow State API. The agent uses tool calling to invoke these skills based on the user's natural language input. You store your Flow State API key as a Pinata Secret, and it gets injected as an environment variable into the agent container.

### Infrastructure / DevOps

| Component          | Technology                              | Purpose                        |
| ------------------ | --------------------------------------- | ------------------------------ |
| Hosting (API)      | Railway, Render, or Vercel (serverless) | Backend deployment             |
| Hosting (Frontend) | Vercel                                  | Next.js deployment             |
| Database           | Neon (serverless Postgres) or Supabase  | Managed PostgreSQL             |
| Cache/Queue        | Upstash Redis                           | BullMQ job queue               |
| CI/CD              | GitHub Actions                          | Automated testing + deployment |
| Monitoring         | Better Stack or Sentry                  | Error tracking                 |

---

## Every Element, Broken Down

### Element 1: MockRLUSD Token (ERC-20)

**What it is:** A simple ERC-20 token deployed to XRPL EVM testnet that simulates RLUSD.

**What to build:**

- `MockRLUSD.sol` — extends OpenZeppelin ERC20, has a public `mint()` function
- Deploy script via Hardhat
- A faucet page or script that mints tokens to demo wallets

**Effort:** ~2 hours

### Element 2: EscrowStateMachine Contract

**What it is:** The core smart contract that holds buyer funds and releases them incrementally as the order progresses through 7 states.

**What to build:**

- State enum: INITIATED → ESCROWED → LABEL_CREATED → SHIPPED → IN_TRANSIT → DELIVERED → FINALIZED (+ DISPUTED branch)
- `transferAndEscrow()` — buyer deposits tokens, state goes to ESCROWED
- `advanceState()` — called by backend when shipping events occur, triggers partial payout
- `initiateDispute()` — freezes remaining funds
- `finalize()` — releases holdback after grace period
- Configurable payout percentages per state (basis points)
- Grace period timer (block timestamp-based)
- Events for every state transition (for the audit trail)

**Effort:** ~8-12 hours (including tests)

### Element 3: DisputeResolver Contract

**What it is:** Manages dispute lifecycle on-chain.

**What to build:**

- Dispute struct with buyer/seller evidence CIDs, deadlines, resolution
- `createDispute()` — records dispute, starts 72h seller timer
- `respondToDispute()` — seller submits counter-evidence
- `resolve()` — executes refund or release based on outcome
- `autoResolve()` — called if seller times out, auto-refunds buyer

**Effort:** ~4-6 hours

### Element 4: PaymentSplitter Contract

**What it is:** Handles all token movements — partial releases, final release with fee deduction, refunds.

**What to build:**

- `releasePartial()` — sends a percentage of escrowed tokens to seller
- `releaseFinal()` — deducts platform fee, sends remainder
- `refundBuyer()` — returns frozen tokens during dispute resolution
- Platform fee wallet address + configurable fee (default 2.5%)

**Effort:** ~3-4 hours

### Element 5: Backend API Server

**What it is:** The hosted REST API that bridges the frontend components, smart contracts, Shippo, Pinata, and the agents.

**What to build (by endpoint group):**

**Orders (most complex):**

- `POST /orders/create` — validates inputs, calls Shippo for rates, converts to token amounts, stores order
- `POST /orders/:id/select-shipping` — purchases Shippo label, pins to IPFS, calculates final escrow amount
- `POST /orders/:id/confirm-escrow` — verifies on-chain tx, generates invoice, pins to IPFS
- `POST /orders/:id/confirm-label-printed` — advances contract state, triggers 15% payout
- `POST /orders/:id/finalize` — called by cron after grace period, releases holdback

**Shipping:**

- `POST /shipping/webhook/shippo` — receives tracking updates, maps to state transitions, calls contract
- `GET /shipping/rates` — wraps Shippo rates API
- `GET /shipping/track/:orderId` — returns current tracking info

**Sellers:**

- `POST /sellers/onboard` — registers seller, verifies wallet
- `GET /sellers/:id/orders` — filtered order list
- `GET /sellers/:id/metrics` — performance dashboard data

**Disputes:**

- `POST /disputes/create` — uploads evidence to IPFS, calls contract
- `POST /disputes/:id/respond` — seller counter-evidence

**Platform:**

- `GET /platform/:projectId/analytics` — aggregate metrics
- `POST /webhooks/register` — platform webhook registration

**Agents:**

- `POST /agents/chat` — routes to correct OpenClaw agent based on user role

**Effort:** ~30-40 hours

### Element 6: Shippo Integration

**What it is:** Third-party shipping API for rate shopping, label generation, and tracking webhooks.

**What to build:**

- Shippo SDK integration (they have a Node.js SDK)
- Rate fetching during checkout
- Label purchase after shipping selection
- Webhook receiver that maps Shippo tracking statuses to your 7 states
- Sandbox mode for testing (Shippo provides test tracking numbers)

**Effort:** ~6-8 hours

### Element 7: Pinata/IPFS Integration

**What it is:** Content-addressed storage for invoices, labels, evidence, and state transition receipts.

**What to build:**

- Pinata SDK setup with API key
- Pin JSON files (invoices, receipts, dispute evidence)
- Pin PDF files (labels)
- CID management — store CIDs in database and reference on-chain
- Gateway URL generation for file retrieval

**Effort:** ~3-4 hours

### Element 8: OpenClaw Agent Skills

**What it is:** Custom skill packages for each of the three agents.

**What to build per agent:**

**BuyerAgent skills (5):**

- `order-status/SKILL.md` + script — calls `GET /orders/:id`
- `track-shipment/SKILL.md` + script — calls `GET /shipping/track/:id`
- `file-dispute/SKILL.md` + script — calls `POST /disputes/create`
- `get-receipt/SKILL.md` + script — returns invoice IPFS URL
- `search-products/SKILL.md` + script — queries demo store products

**SellerAgent skills (5):**

- `list-orders/SKILL.md` + script — calls `GET /sellers/:id/orders`
- `get-metrics/SKILL.md` + script — calls `GET /sellers/:id/metrics`
- `confirm-label/SKILL.md` + script — calls `POST /orders/:id/confirm-label-printed`
- `respond-dispute/SKILL.md` + script — calls `POST /disputes/:id/respond`
- `get-payouts/SKILL.md` + script — calls payout history endpoint

**AdminAgent skills (5):**

- `get-analytics/SKILL.md` + script — calls `GET /platform/:id/analytics`
- `list-sellers/SKILL.md` + script — calls seller listing endpoint
- `webhook-logs/SKILL.md` + script — calls webhook log endpoint
- `gas-report/SKILL.md` + script — queries on-chain gas usage
- `flagged-sellers/SKILL.md` + script — calls flagged sellers endpoint

**Effort:** ~10-15 hours (deploy 3 agents on Pinata, write 15 skill packages)

### Element 9: The `@flowstate/gateway` NPM Package

**What it is:** The developer-facing package that wraps everything into drop-in components.

**What to build:**

- `FlowStateProvider` — React context that holds config (project ID, API key, theme)
- `PayButton` — button that triggers checkout overlay with shipping selection, wallet connection, and escrow flow
- `BuyerChat` — chat widget that connects to BuyerAgent via your `/agents/chat` endpoint
- `SellerDashboard` — full dashboard component (orders, labels, payouts, SellerAgent chat)
- `AdminDashboard` — full dashboard component (analytics, sellers, AdminAgent chat)
- `OrderTracker` — embeddable order status widget showing the 7-state FSM
- `FlowStateServer` — Node.js webhook handler with signature verification
- TypeScript types for all API responses

**Effort:** ~20-25 hours

### Element 10: Demo E-Commerce Store

**What it is:** A fake store ("FlowShop" or similar) that uses `@flowstate/gateway` to demonstrate the full buyer → seller → admin flow.

**What to build:**

- Next.js app with product listings (fake data, maybe 5-10 products)
- Product detail pages
- Integration of `<PayButton />` on product pages
- Buyer order history page with `<OrderTracker />`
- Seller section using `<SellerDashboard />`
- Admin section using `<AdminDashboard />`
- Wallet connection flow (MetaMask connecting to XRPL EVM testnet)
- Seed script to populate demo data

**Effort:** ~15-20 hours

---

## The Oracle + Crypto-Conditions Fallback

You mentioned this as a fallback if "normal escrow code execution on blockchain doesn't work." Here's how it maps:

**XRPL native escrow uses crypto-conditions (PREIMAGE-SHA-256):** An oracle (your backend server) generates a random 32-byte preimage, hashes it to create a condition, and gives the condition to the escrow creator. The escrow locks funds with that condition. When the oracle determines the real-world condition is met (e.g., package delivered), it reveals the preimage (fulfillment), and anyone can finish the escrow.

**How this could work for Flow State as a fallback:**

- Create 5 separate native XRPL escrows per order (one per payout milestone)
- Your backend acts as the oracle, generating condition/fulfillment pairs for each
- When Shippo webhooks confirm a shipping event, your oracle releases the corresponding fulfillment
- The seller (or your backend) submits EscrowFinish with the fulfillment to release funds

**This is viable but significantly more complex to manage than a single Solidity FSM.** I'd recommend building the EVM path as your primary and only mentioning this as "future XRPL L1 native support" in your architecture docs.

---

## Recommended Build Order

1. **Smart contracts** — MockRLUSD, EscrowStateMachine, DisputeResolver, PaymentSplitter. Deploy to XRPL EVM testnet. Write comprehensive tests.
2. **Backend API** — Orders and shipping endpoints first. Get the core flow working: create order → escrow → state advances → finalize.
3. **Pinata/IPFS integration** — Wire up invoice and label pinning.
4. **Shippo integration** — Connect sandbox mode for rates and tracking.
5. **Demo store frontend** — Basic product pages, checkout flow with `<PayButton />`.
6. **Wallet integration** — MetaMask connecting to XRPL EVM testnet, token approval and escrow deposit.
7. **Agent skills** — Write the 15 skill packages.
8. **Pinata agents** — Deploy 3 OpenClaw agents, attach skills, test tool calling.
9. **Dashboard components** — Seller and admin dashboards with embedded agent chat.
10. **Package the gateway** — Bundle everything into `@flowstate/gateway`.
11. **Polish and demo** — End-to-end flow, error handling, loading states, demo script.

---

## Total Estimated Effort

| Component                    | Hours              |
| ---------------------------- | ------------------ |
| Smart contracts + tests      | 15-22              |
| Backend API                  | 30-40              |
| Shippo integration           | 6-8                |
| Pinata/IPFS integration      | 3-4                |
| OpenClaw agents + skills     | 10-15              |
| Gateway npm package          | 20-25              |
| Demo e-commerce store        | 15-20              |
| Wallet integration           | 5-8                |
| DevOps / deployment          | 5-8                |
| Testing / polish / demo prep | 10-15              |
| **Total**                    | **~120-165 hours** |

For a team of 2-3 developers, that's roughly 3-5 weeks of focused work.

---

## Key External Accounts You'll Need

1. **XRPL EVM Testnet** — free, just need MetaMask configured
2. **Shippo** — free sandbox account (sign up at goshippo.com)
3. **Pinata** — paid plan required for Agents (free tier for IPFS pinning)
4. **Anthropic** — API key for Claude (used by OpenClaw agents)
5. **Vercel** — free tier for frontend hosting
6. **Neon/Supabase** — free tier for PostgreSQL
7. **GitHub** — repository + Actions for CI/CD
