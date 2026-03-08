# Plan: Restructure @flowstate/gateway as a Proper npm Package

## Context

FlowState has three tiers:
- **`packages/gateway/`** — `@flowstate/gateway` npm package, published publicly, installed by any e-commerce developer
- **`backend/`** — hosted SaaS API at `api.flowstate.xyz`, deployed on cloud, not shipped to developers
- **`demo-store/`** — showcase Next.js app demonstrating the npm package + backend integration

Currently `backend/gateway/` contains the package code mixed with backend code. This plan moves it to a proper `packages/gateway/` directory, publishes to npm, and cleans up the demo-store to import from npm.

---

## Prerequisites (Manual — Do Before Running This Plan)

1. **Create npm org** at npmjs.com → sign in → Add Organization → name: `flowstate` → Unlimited public packages ($0/month)
2. **Login to npm** in terminal:
   ```bash
   npm login
   npm org ls flowstate   # verify you're a member
   ```
3. Confirm `@flowstate/gateway` is available on npm (search at npmjs.com)

---

## Step 1 — Set Up Root npm Workspaces

Create a root `package.json` to link `packages/gateway` and `demo-store` during local development without needing to publish for every change.

**Create `flowstate/package.json`:**
```json
{
  "name": "flowstate-monorepo",
  "private": true,
  "workspaces": [
    "packages/*",
    "demo-store"
  ],
  "scripts": {
    "gateway:build": "npm run build --workspace=packages/gateway",
    "gateway:dev": "npm run dev --workspace=packages/gateway",
    "demo:dev": "npm run dev --workspace=demo-store",
    "demo:build": "npm run build --workspace=demo-store"
  }
}
```

**Create `flowstate/.npmrc`** (ensures scoped packages publish publicly by default):
```
access=public
```

---

## Step 2 — Create `packages/gateway/` Structure

```
packages/
└── gateway/
    ├── src/
    │   ├── components/
    │   │   ├── FlowStateProvider.tsx
    │   │   ├── EscrowProgressBar.tsx
    │   │   ├── OrderTracker.tsx
    │   │   ├── AgentChat.tsx
    │   │   ├── BuyerChat.tsx
    │   │   ├── SellerDashboard.tsx
    │   │   ├── AdminDashboard.tsx
    │   │   └── PayButton.tsx
    │   ├── server/
    │   │   ├── FlowStateServer.ts     (webhook verifier + HMAC)
    │   │   └── webhookVerifier.ts
    │   ├── client/
    │   │   ├── apiClient.ts           (typed fetch wrapper)
    │   │   └── wsClient.ts            (WebSocket + auto-reconnect)
    │   ├── types/
    │   │   ├── index.ts               (Order, Seller, Dispute, etc.)
    │   │   └── webhooks.ts            (WebhookEvent, WebhookEnvelope, etc.)
    │   └── index.ts                   (barrel — exports everything)
    ├── package.json
    ├── tsconfig.json
    ├── tsup.config.ts
    └── README.md
```

---

## Step 3 — `packages/gateway/package.json`

```json
{
  "name": "@flowstate/gateway",
  "version": "1.0.0",
  "description": "React + Node SDK for the FlowState escrow payment gateway",
  "author": "FlowState",
  "license": "MIT",
  "homepage": "https://flowstate.xyz",
  "repository": {
    "type": "git",
    "url": "https://github.com/shivanshshrivas/flowstate"
  },
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    },
    "./server": {
      "types": "./dist/server/index.d.ts",
      "import": "./dist/server/index.js",
      "require": "./dist/server/index.cjs"
    }
  },
  "files": [
    "dist"
  ],
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "prepublishOnly": "npm run build",
    "typecheck": "tsc --noEmit"
  },
  "peerDependencies": {
    "react": ">=18",
    "react-dom": ">=18"
  },
  "peerDependenciesMeta": {
    "react-dom": { "optional": true }
  },
  "dependencies": {
    "clsx": "^2.1.1",
    "lucide-react": "^0.515.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "react": "^19.0.0",
    "tsup": "^8.0.0",
    "typescript": "^5.9.3"
  }
}
```

---

## Step 4 — `packages/gateway/tsup.config.ts`

```typescript
import { defineConfig } from "tsup";

export default defineConfig([
  // Client bundle (React components + apiClient + wsClient + types)
  {
    entry: { index: "src/index.ts" },
    format: ["esm", "cjs"],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: true,
    external: ["react", "react-dom"],
    outDir: "dist",
  },
  // Server bundle (FlowStateServer — no React, Node.js only)
  {
    entry: { "server/index": "src/server/index.ts" },
    format: ["esm", "cjs"],
    dts: true,
    splitting: false,
    sourcemap: true,
    platform: "node",
    outDir: "dist",
  },
]);
```

---

## Step 5 — `packages/gateway/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2020", "DOM"],
    "jsx": "react-jsx",
    "declaration": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"],
  "exclude": ["dist", "node_modules"]
}
```

---

## Step 6 — Migrate Source Files

Copy source files from current locations into `packages/gateway/src/`:

| Current Location | New Location |
|---|---|
| `backend/gateway/FlowStateProvider.tsx` | `packages/gateway/src/components/FlowStateProvider.tsx` |
| `backend/gateway/EscrowProgressBar.tsx` | `packages/gateway/src/components/EscrowProgressBar.tsx` |
| `backend/gateway/OrderTracker.tsx` | `packages/gateway/src/components/OrderTracker.tsx` |
| `backend/gateway/AgentChat.tsx` | `packages/gateway/src/components/AgentChat.tsx` |
| `backend/gateway/BuyerChat.tsx` | `packages/gateway/src/components/BuyerChat.tsx` |
| `backend/gateway/SellerDashboard.tsx` | `packages/gateway/src/components/SellerDashboard.tsx` |
| `backend/gateway/AdminDashboard.tsx` | `packages/gateway/src/components/AdminDashboard.tsx` |
| `backend/gateway/PayButton.tsx` | `packages/gateway/src/components/PayButton.tsx` |
| `backend/gateway/apiClient.ts` | `packages/gateway/src/client/apiClient.ts` |
| `backend/gateway/wsClient.ts` | `packages/gateway/src/client/wsClient.ts` |
| `backend/gateway/server.ts` | `packages/gateway/src/server/FlowStateServer.ts` |
| `backend/gateway/types/index.ts` | `packages/gateway/src/types/index.ts` |
| `backend/gateway/types/webhooks.ts` | `packages/gateway/src/types/webhooks.ts` |

**Delete after migration:**
- `backend/gateway/` — entire directory
- Remove the old `flowstate-gateway-0.0.1.tgz` and `flowstate-gateway-0.1.0.tgz` tarballs

---

## Step 7 — `packages/gateway/src/index.ts` (barrel export)

```typescript
// Components
export { FlowStateProvider, useFlowState } from "./components/FlowStateProvider";
export type { FlowStateProviderProps } from "./components/FlowStateProvider";

export { PayButton } from "./components/PayButton";
export type { PayButtonProps } from "./components/PayButton";

export { OrderTracker } from "./components/OrderTracker";
export type { OrderTrackerProps } from "./components/OrderTracker";

export { EscrowProgressBar } from "./components/EscrowProgressBar";
export type { EscrowProgressBarProps } from "./components/EscrowProgressBar";

export { BuyerChat } from "./components/BuyerChat";
export type { BuyerChatProps } from "./components/BuyerChat";

export { SellerDashboard } from "./components/SellerDashboard";
export type { SellerDashboardProps } from "./components/SellerDashboard";

export { AdminDashboard } from "./components/AdminDashboard";
export type { AdminDashboardProps } from "./components/AdminDashboard";

export { AgentChat } from "./components/AgentChat";
export type { AgentChatProps } from "./components/AgentChat";

// Client SDK
export { FlowStateApiClient } from "./client/apiClient";
export type { FlowStateApiClientConfig } from "./client/apiClient";

export { FlowStateWsClient } from "./client/wsClient";

// Types (enums exported as values)
export { OrderState, DisputeStatus, ORDER_STATE_LABELS, ORDER_STATE_SEQUENCE } from "./types/index";
export type {
  Order, OrderItem, ShippingOption, ShippingAddress, EscrowDetails,
  PayoutSchedule, StateTransition, Seller, PayoutConfig, SellerMetrics,
  PayoutRecord, Dispute, DisputeEvidence, Resolution, PlatformAnalytics,
  WebhookEvent, FlowStateConfig, FlowStateTheme, UserRole, User,
  ChatMessage, SuggestedAction, AgentResponse,
} from "./types/index";

// Webhook types
export type {
  WebhookEventType, WebhookEventMap, WebhookEnvelope,
  OrderStateChangedPayload, OrderStatusUpdatedPayload,
  PayoutReleasedPayload, DisputeCreatedPayload, DisputeResolvedPayload,
} from "./types/webhooks";
```

**`packages/gateway/src/server/index.ts`** (server-only barrel):
```typescript
export { FlowStateServer } from "./FlowStateServer";
export type { FlowStateServerConfig } from "./FlowStateServer";
export { verifyWebhookSignature } from "./FlowStateServer";
```

---

## Step 8 — Fix Internal Imports in Migrated Files

After copying files, update internal import paths. All files previously used relative paths like `"../types"` or `"./types/index"`. Update to match new structure:

- In components: `from "../types/index"` → stays the same relative path, just verify
- In `OrderTracker.tsx`: remove `XRPL_EXPLORER_URL` import from `@/lib/constants` — make it a prop with default value `"https://explorer.testnet.xrplevm.org"`
- In `EscrowProgressBar.tsx`: already uses `clsx` directly ✓
- Remove any remaining `@/` path aliases — the package has no Next.js context

---

## Step 9 — Install and Build the Package

```bash
# From repo root
npm install           # installs all workspaces

# Build the package
cd packages/gateway
npm run build         # tsup compiles → dist/

# Verify dist/ output
ls dist/
# Should see: index.js, index.cjs, index.d.ts, server/index.js, etc.
```

---

## Step 10 — Publish to npm

```bash
cd packages/gateway

# Dry run first to see what gets published
npm publish --dry-run

# If it looks correct, publish
npm publish --access public
```

---

## Step 11 — Update demo-store to Install from npm

```bash
cd demo-store

# Remove the old file: tarball dependency
npm uninstall @flowstate/gateway

# Install from npm registry
npm install @flowstate/gateway
```

Update `demo-store/package.json`:
```json
"@flowstate/gateway": "^1.0.0"   // replaces "file:../backend/gateway/flowstate-gateway-0.1.0.tgz"
```

---

## Step 12 — Delete `demo-store/src/lib/flowstate/`

The entire directory gets deleted:
```bash
rm -rf demo-store/src/lib/flowstate/
```

This removes:
- `src/lib/flowstate/client/` (FlowStateProvider, PayButton, OrderTracker, EscrowProgressBar, etc.)
- `src/lib/flowstate/contracts/` (ABIs)
- `src/lib/flowstate/types/`
- `src/lib/flowstate/index.ts`

---

## Step 13 — Update All Imports in demo-store

Replace all `@/lib/flowstate` imports with `@flowstate/gateway`.

**Find all occurrences:**
```bash
grep -r "@/lib/flowstate" demo-store/src --include="*.ts" --include="*.tsx" -l
```

**Files that will need updating:**
- `demo-store/src/stores/order-store.ts` — import types
- `demo-store/src/app/checkout/page.tsx` — import types + components
- `demo-store/src/app/orders/page.tsx` — import types
- `demo-store/src/app/orders/[id]/page.tsx` — already updated to `@flowstate/gateway` ✓
- `demo-store/src/app/seller/page.tsx` — already updated ✓
- `demo-store/src/app/admin/page.tsx` — already updated ✓
- `demo-store/src/components/providers.tsx` — already updated ✓
- `demo-store/src/components/products/BuyerPayButton.tsx` — imports local PayButton
- Any other files found by the grep above

**Pattern to replace:**
```typescript
// Before
import { Order, OrderState } from "@/lib/flowstate/types";
import { EscrowProgressBar } from "@/lib/flowstate";

// After
import { Order, OrderState, EscrowProgressBar } from "@flowstate/gateway";
```

**ABIs** — The contract ABIs (`MockRLUSD.abi.ts`, `EscrowStateMachine.abi.ts`) currently live in `src/lib/flowstate/contracts/`. After deleting that directory, move them to `src/lib/contracts/` within demo-store (they're demo-store-specific, not part of the npm package).

---

## Step 14 — Update demo-store Environment Variables

Add to `demo-store/.env.local`:
```env
NEXT_PUBLIC_FLOWSTATE_API_URL=http://localhost:3001
NEXT_PUBLIC_FLOWSTATE_API_KEY=your_api_key_here
NEXT_PUBLIC_FLOWSTATE_PROJECT_ID=demo

# Server-side (for API route proxying)
FLOWSTATE_API_URL=http://localhost:3001
FLOWSTATE_API_KEY=your_api_key_here
```

For production:
```env
NEXT_PUBLIC_FLOWSTATE_API_URL=https://api.flowstate.xyz
```

---

## Step 15 — Verify Build

```bash
# Build and typecheck the package
cd packages/gateway
npm run typecheck
npm run build

# Build the demo-store
cd demo-store
npm run build
# Should compile with zero errors

# Run backend tests
cd backend
npx vitest run
# Should pass all 122 tests
```

---

## Step 16 — Update Root `.gitignore`

Add to `flowstate/.gitignore`:
```
# Gateway package build output (generated by tsup)
packages/gateway/dist/
packages/gateway/node_modules/

# Tarballs (no longer needed — using npm registry)
backend/gateway/*.tgz
```

---

## File Summary

| Action | Path |
|--------|------|
| CREATE | `packages/gateway/` (entire directory) |
| CREATE | `package.json` (root workspace) |
| CREATE | `.npmrc` (root) |
| DELETE | `backend/gateway/` (entire directory) |
| DELETE | `demo-store/src/lib/flowstate/` (entire directory) |
| UPDATE | `demo-store/package.json` — npm dep instead of tarball |
| UPDATE | All `demo-store/src/**` files with `@/lib/flowstate` imports |
| UPDATE | `demo-store/src/components/products/BuyerPayButton.tsx` |
| MOVE | `demo-store/src/lib/flowstate/contracts/` → `demo-store/src/lib/contracts/` |

---

## Local Dev Workflow (After This Plan)

Because of npm workspaces, during local development:
```bash
# From repo root — installs all packages, links gateway into demo-store automatically
npm install

# Develop the package (watch mode)
npm run gateway:dev

# In another terminal, run demo-store
npm run demo:dev
```

When you make changes to `packages/gateway/src/`, they are immediately available in `demo-store` without re-publishing — the workspace symlink handles it.

**To publish a new version:**
```bash
cd packages/gateway
# bump version in package.json (e.g. 1.0.0 → 1.0.1)
npm publish --access public
```

---

## Notes

- **`FlowStateCheckoutButton`** (the old thin button primitive) — **drop it**. `PayButton` replaces it entirely.
- **ABIs** — keep them in `demo-store/src/lib/contracts/`, they're platform-specific (XRPL EVM addresses). Not part of the public SDK.
- **`docs-site/`** — eventually this becomes the developer registration portal + docs for `api.flowstate.xyz`. Out of scope for this plan.
- **tsup vs tsc** — tsup handles ESM + CJS dual output, tree shaking, and `.d.ts` generation in one step. Much cleaner than raw `tsc` for npm packages.
