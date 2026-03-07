# FlowState Demo Store

A Next.js demo e-commerce storefront showcasing the FlowState blockchain escrow payment gateway on XRPL EVM Sidechain.

## What This Demos

- **Buyer flow**: Browse products → Connect MetaMask → Checkout with escrow → Track order through 7 states
- **Seller flow**: Dashboard with orders, fulfillment actions, payout history, metrics
- **Admin flow**: Platform analytics, seller management, webhook event logs
- **Faucet**: Get test XRP + MockRLUSD (FLUSD) for the testnet

## Setup

```bash
cd demo-store
cp .env.example .env.local
npm install
npm run dev
```

Open http://localhost:3000.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | No* | WalletConnect project ID |
| `NEXT_PUBLIC_SUPABASE_URL` | No* | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | No* | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | No* | Supabase service role key |
| `NEXT_PUBLIC_MOCK_RLUSD_ADDRESS` | No* | Deployed MockRLUSD contract address |
| `NEXT_PUBLIC_ESCROW_STATE_MACHINE_ADDRESS` | No* | EscrowStateMachine address |
| `NEXT_PUBLIC_DISPUTE_RESOLVER_ADDRESS` | No* | DisputeResolver address |
| `NEXT_PUBLIC_PAYMENT_SPLITTER_ADDRESS` | No* | PaymentSplitter address |

*App runs with full mock data without any env vars set.

## Database Setup

Run `scripts/seed.sql` in Supabase SQL editor to create tables and seed demo data.

## Architecture

```
src/
├── app/                    # Next.js App Router pages + API routes
├── components/
│   ├── ui/                 # Shared UI components (Radix UI + Tailwind)
│   ├── layout/             # Header, Footer
│   ├── products/           # ProductCard, ProductGrid
│   ├── checkout/           # CheckoutOverlay, ShippingSelector
│   └── orders/             # OrderCard, OrderStatusBadge
├── lib/
│   ├── flowstate/          # @flowstate/gateway mirror
│   │   ├── client/         # FlowStateProvider, PayButton, OrderTracker
│   │   ├── contracts/      # ABI stubs
│   │   ├── types/          # Shared TypeScript types
│   │   └── index.ts
│   ├── constants.ts        # Chain config, contract addresses (env-var-driven)
│   ├── wagmi.ts            # Wallet config (XRPL EVM Testnet chain ID 1449000)
│   ├── supabase.ts         # Supabase client helpers
│   ├── mock-data.ts        # Demo products, sellers, orders, analytics
│   └── utils.ts            # Formatting helpers
└── stores/
    ├── cart-store.ts       # Zustand cart (persisted to localStorage)
    └── order-store.ts      # Zustand order state with demo advance
```

## Swapping to @flowstate/gateway

When the npm package ships, find all gateway imports:

```bash
grep -r "@/lib/flowstate" src/ --include="*.ts" --include="*.tsx"
```

Replace with `@flowstate/gateway`. The export surface is identical.

## XRPL EVM Testnet

- Chain ID: 1449000
- RPC: https://rpc.testnet.xrplevm.org
- Explorer: https://explorer.testnet.xrplevm.org
- Faucet: https://faucet.xrplevm.org

## Tech Stack

- Next.js 16 (App Router, TypeScript)
- Tailwind CSS v4 + Radix UI primitives
- RainbowKit + wagmi + viem (wallet)
- Zustand (client state)
- Supabase (PostgreSQL, optional)
- Recharts (admin charts)
