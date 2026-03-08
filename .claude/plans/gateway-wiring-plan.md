# Plan: Wire Demo-Store Through Gateway SDK to FlowState Backend

## Context

The FlowState project has three disconnected tiers that need to be connected:
- **Backend API** (fully functional, 122 tests passing) — but uses `BlockchainBridgeStub` (mock data)
- **Gateway SDK** (`backend/gateway/`) — only has `FlowStateCheckoutButton` (thin button), `FlowStateServer` (webhook verifier), webhook types
- **Demo-store** — runs entirely on Supabase simulation code in `demo-store/src/lib/flowstate/` and `demo-store/src/lib/order-data.ts`; never calls the FlowState backend

**Goal**: Wire demo-store → gateway SDK → backend API so the checkout, tracking, dashboard, and agent chat flows work end-to-end. Keep `BlockchainBridgeStub` for now (real contracts are a separate phase).

---

## Phase 7: Gateway SDK — Types + ApiClient (foundation)

### 7a. Port types to gateway SDK
- **Create** `backend/gateway/types/index.ts`
- **Source**: Copy from `demo-store/src/lib/flowstate/types/index.ts` (268 lines)
- Port all: `OrderState`, `Order`, `OrderItem`, `ShippingOption`, `ShippingAddress`, `EscrowDetails`, `PayoutSchedule`, `StateTransition`, `Seller`, `SellerMetrics`, `PayoutRecord`, `Dispute`, `DisputeStatus`, `DisputeEvidence`, `Resolution`, `PlatformAnalytics`, `WebhookEvent`, `FlowStateConfig`, `FlowStateTheme`, `UserRole`, `User`
- Keep `Product` out (platform-specific, stays in demo-store)
- Add `ORDER_STATE_LABELS`, `ORDER_STATE_SEQUENCE` constants
- Existing `types/webhooks.ts` stays alongside

### 7b. Create gateway apiClient
- **Create** `backend/gateway/apiClient.ts`
- Browser-compatible typed `fetch()` wrapper, constructor: `{ baseUrl, apiKey }`
- Methods map 1:1 to backend routes (see `backend/src/routes/orders.routes.ts` for schemas):
  - Orders: `createOrder`, `selectShipping`, `confirmEscrow`, `confirmLabelPrinted`, `finalizeOrder`, `getOrder`
  - Shipping: `getShippingRates`, `trackShipment`
  - Sellers: `onboardSeller`, `getSellerOrders`, `getSellerMetrics`, `getSellerPayouts`
  - Disputes: `createDispute`, `respondToDispute`, `resolveDispute`
  - Platform: `getPlatformAnalytics`, `getPlatformSellers`, `getGasCosts`
  - Webhooks: `registerWebhook`, `getWebhookLogs`
  - Agents: `chatWithAgent`
  - Auth: `createProject`, `rotateApiKey`
- All unwrap `{ success, data }` envelope, throw on `success: false`
- Reference: `mcp-agents/src/utils/api-client.ts` for pattern

### 7c. Create gateway WebSocket client
- **Create** `backend/gateway/wsClient.ts`
- Connects to backend's `/ws` endpoint
- Sends auth handshake `{ type: "auth", token: apiKey }`
- Exposes EventEmitter-style API: `on('order_state_changed', cb)`, `on('payout_released', cb)`, etc.
- Auto-reconnect with backoff

### 7d. Update barrel exports
- **Update** `backend/gateway/index.ts` — re-export apiClient, wsClient, all types

---

## Phase 8: Gateway SDK — Client Components

### 8a. FlowStateProvider
- **Create** `backend/gateway/FlowStateProvider.tsx`
- Extends current simulation provider (`demo-store/src/lib/flowstate/client/FlowStateProvider.tsx`)
- Adds `baseUrl` to `FlowStateConfig`, initializes `FlowStateApiClient` + `FlowStateWsClient` in context
- Hook: `useFlowState()` returns `{ config, contracts, apiClient, wsClient }`

### 8b. EscrowProgressBar
- **Create** `backend/gateway/EscrowProgressBar.tsx`
- Port from `demo-store/src/lib/flowstate/client/EscrowProgressBar.tsx`
- Replace `@/lib/utils` (`cn()`) with bundled `clsx` utility
- Replace `@/components/ui/*` imports with inline or peer-dep `lucide-react`
- Declare peer deps: `react`, `lucide-react`, `clsx`

### 8c. OrderTracker
- **Create** `backend/gateway/OrderTracker.tsx`
- Port from `demo-store/src/lib/flowstate/client/OrderTracker.tsx`
- Add `useOrderUpdates(orderId)` hook using `wsClient` from context for live updates
- Same peer-dep approach as EscrowProgressBar

### 8d. AgentChat (base component)
- **Create** `backend/gateway/AgentChat.tsx`
- Shared chat widget used by BuyerChat, SellerDashboard, AdminDashboard
- Props: `role: 'buyer' | 'seller' | 'admin'`, `userId: string`, `variant?: 'floating' | 'inline' | 'panel'`
- Features: message input, response display, typing indicator, suggested action buttons
- Calls `apiClient.chatWithAgent(role, userId, message)` via `useFlowState()` context
- Connected to MCP agents (buyer_agent_chat / seller_agent_chat / admin_agent_chat)

### 8e. BuyerChat
- **Create** `backend/gateway/BuyerChat.tsx`
- Thin wrapper around `AgentChat` with `role="buyer"`, default `variant="floating"`
- Props: `userId: string` (buyer wallet address)
- Floating chat bubble for order pages — buyer can ask about order status, file disputes, get receipts

### 8f. SellerDashboard
- **Create** `backend/gateway/SellerDashboard.tsx`
- Embeddable SDK component — drop-in replacement for demo-store's `/seller` page
- Port from `demo-store/src/app/seller/page.tsx` structure
- **4 tabs**: Orders (filterable list + EscrowProgressBar + action buttons), Products, Payouts, Metrics
- **Embedded SellerAgent chat panel** — uses `AgentChat` with `role="seller"`, `variant="panel"`
- Data fetched via `apiClient`: `getSellerOrders()`, `getSellerMetrics()`, `getSellerPayouts()`
- Props: `sellerId: string`, `onConfirmLabel?: (orderId) => void`, `onRespondDispute?: (disputeId) => void`

### 8g. AdminDashboard
- **Create** `backend/gateway/AdminDashboard.tsx`
- Embeddable SDK component — drop-in replacement for demo-store's `/admin` page
- Port from `demo-store/src/app/admin/page.tsx` structure
- **4 tabs**: Analytics (charts + metrics), Orders (pipeline view), Sellers (management), Webhooks (logs)
- **Embedded AdminAgent chat panel** — uses `AgentChat` with `role="admin"`, `variant="panel"`
- Data fetched via `apiClient`: `getPlatformAnalytics()`, `getPlatformSellers()`, `getWebhookLogs()`, `getGasCosts()`
- Props: `projectId: string`
- Peer dep: `recharts` (for analytics charts)

### 8h. PayButton (full checkout overlay)
- **Create** `backend/gateway/PayButton.tsx`
- The architecture describes a button that triggers a **checkout overlay** (not a full page)
- Replaces existing `FlowStateCheckoutButton` (thin button) as the high-level component
- Checkout overlay flow: shipping address → shipping selection → payment review → wallet approval → escrow deposit
- Internally calls: `apiClient.createOrder()` → `apiClient.getShippingRates()` → `apiClient.selectShipping()` → wallet tx → `apiClient.confirmEscrow()`
- Props: `items`, `sellerId`, `sellerWallet`, `addressFrom`, `onSuccess`, `onError`
- `FlowStateCheckoutButton` stays as the low-level styled button primitive

### 8i. Update gateway package.json
- Add `peerDependencies`: `react >= 18`, `lucide-react`, `clsx`, `recharts` (for AdminDashboard)
- Add `files` array for npm pack
- Bump version to `0.1.0`

---

## Phase 9: Backend — Add List Orders Endpoint

**Gap**: Backend has `GET /orders/:id` but no `GET /orders` (list). Needed for orders page.

### 9a. Add list endpoint
- **Update** `backend/src/routes/orders.routes.ts` — add `GET /` with query filters: `buyer_wallet`, `seller_id`, `status`, `limit`, `offset`
- **Update** `backend/src/services/order.service.ts` — add `list()` method
- **Add test** for the new endpoint

---

## Phase 10: Demo-Store — API Route Proxying

Replace Supabase simulation with backend API calls. Use env flag: when `FLOWSTATE_API_URL` is set, proxy to backend; otherwise fall back to Supabase (preserving demo-without-backend mode).

### 10a. Server-side API client
- **Create** `demo-store/src/lib/flowstate-api.ts`
- Instantiates `FlowStateApiClient` from `@flowstate/gateway` with env vars `FLOWSTATE_API_URL` + `FLOWSTATE_API_KEY`
- Exports singleton `flowstateApi`

### 10b. Update order API routes
- **Update** `demo-store/src/app/api/orders/route.ts`
  - `GET`: If `FLOWSTATE_API_URL` set → `flowstateApi.listOrders({ buyer_wallet })`, else Supabase
  - `POST`: If set → `flowstateApi.createOrder(...)` with schema translation (demo-store fields → backend fields), else Supabase
- **Update** `demo-store/src/app/api/orders/[id]/route.ts`
  - `GET`: If set → `flowstateApi.getOrder(id)`, else Supabase
  - `PATCH` (state advance): Map target state to correct backend endpoint (`confirmLabelPrinted`, `finalize`, etc.)

### 10c. Update seller/admin API routes
- **Update** `demo-store/src/app/api/sellers/route.ts` — proxy to `/api/v1/sellers/`
- **Add** `demo-store/src/app/api/agents/chat/route.ts` — proxy to `/api/v1/agents/chat`

---

## Phase 11: Demo-Store — Frontend Import Swap

### 11a. Swap FlowStateProvider
- **Update** `demo-store/src/components/providers.tsx`
  - Import `FlowStateProvider` from `@flowstate/gateway` instead of `@/lib/flowstate/client/FlowStateProvider`
  - Add `baseUrl: process.env.NEXT_PUBLIC_FLOWSTATE_API_URL` to config

### 11b. Swap component imports across pages
- `demo-store/src/app/orders/[id]/page.tsx` — OrderTracker, EscrowProgressBar from `@flowstate/gateway`
- `demo-store/src/app/checkout/page.tsx` — types from `@flowstate/gateway`
- `demo-store/src/stores/order-store.ts` — types from `@flowstate/gateway`

### 11c. Replace seller page with SellerDashboard
- **Update** `demo-store/src/app/seller/page.tsx`
  - Replace the 400+ lines of custom seller dashboard with `<SellerDashboard sellerId={sellerId} />`
  - Keep `RequireRole` guard, Supabase user lookup for sellerId
  - The SDK component handles all tabs, data fetching, and SellerAgent chat

### 11d. Replace admin page with AdminDashboard
- **Update** `demo-store/src/app/admin/page.tsx`
  - Replace the 500+ lines of custom admin dashboard with `<AdminDashboard projectId={projectId} />`
  - Keep `RequireRole` guard
  - The SDK component handles all tabs, data fetching, and AdminAgent chat

### 11e. Add BuyerChat to order detail
- **Update** `demo-store/src/app/orders/[id]/page.tsx` — add `<BuyerChat userId={wallet} />` floating widget

### 11f. Wire checkout to PayButton overlay (optional)
- The current checkout is a full page with multi-step flow
- Option A: Keep the full page checkout (it works well for the demo)
- Option B: Add a `<PayButton>` overlay on product detail pages for quick single-item checkout
- **Recommendation**: Do both — keep full-page checkout for cart, add PayButton overlay on product detail

---

## Phase 12: Repackage and Verify

### 12a. Build gateway
- Add/update `backend/gateway/tsconfig.json` for TSX compilation
- `cd backend/gateway && tsc && npm pack`

### 12b. Update demo-store dependency
- Update `demo-store/package.json` tarball path
- `npm install` in demo-store

### 12c. Smoke test
- Start backend: `cd backend && npm run dev`
- Start MCP agents: `cd mcp-agents && npm run dev`
- Start demo-store: `cd demo-store && npm run dev`
- Test: Create order → select shipping → escrow → track → seller advance → finalize
- Test: BuyerChat sends message, gets agent response
- Test: Seller dashboard shows orders
- Test: Admin dashboard shows analytics

### 12d. Run test suites
```bash
cd backend && npx vitest run          # 122+ tests
cd demo-store && npm run build        # verify no broken imports
```

---

## Schema Translation Notes

Demo-store `createOrder` payload (from `order-data.ts`):
```
{ items, seller_id, shipping_option, shipping_address, buyer_wallet, total_usd, total_token }
```

Backend `POST /orders/create` expects (from `orders.routes.ts`):
```
{ seller_id, buyer_wallet, seller_wallet, address_from, address_to, parcel, items[] }
```

Key differences:
- Backend needs `seller_wallet` (lookup from sellers table), `address_from` (seller address), `address_to` (buyer shipping address), `parcel` (weight/dimensions)
- Backend items have `{ name, quantity, unitPriceUsd, weightOz }` vs demo-store's `{ product_id, product_name, quantity, price_usd }`
- Backend returns `{ order_id, shipping_options, escrow_address, subtotal_usd }` — the demo-store proxy must translate these back to the frontend's expected format

---

## Files Summary

| Phase | File | Action |
|-------|------|--------|
| 7a | `backend/gateway/types/index.ts` | Create |
| 7b | `backend/gateway/apiClient.ts` | Create |
| 7c | `backend/gateway/wsClient.ts` | Create |
| 7d | `backend/gateway/index.ts` | Update |
| 8a | `backend/gateway/FlowStateProvider.tsx` | Create |
| 8b | `backend/gateway/EscrowProgressBar.tsx` | Create |
| 8c | `backend/gateway/OrderTracker.tsx` | Create |
| 8d | `backend/gateway/AgentChat.tsx` | Create |
| 8e | `backend/gateway/BuyerChat.tsx` | Create |
| 8f | `backend/gateway/SellerDashboard.tsx` | Create |
| 8g | `backend/gateway/AdminDashboard.tsx` | Create |
| 8h | `backend/gateway/PayButton.tsx` | Create |
| 8i | `backend/gateway/package.json` | Update |
| 9a | `backend/src/routes/orders.routes.ts` | Update |
| 9a | `backend/src/services/order.service.ts` | Update |
| 10a | `demo-store/src/lib/flowstate-api.ts` | Create |
| 10b | `demo-store/src/app/api/orders/route.ts` | Update |
| 10b | `demo-store/src/app/api/orders/[id]/route.ts` | Update |
| 10c | `demo-store/src/app/api/sellers/route.ts` | Update |
| 10c | `demo-store/src/app/api/agents/chat/route.ts` | Create |
| 11a | `demo-store/src/components/providers.tsx` | Update |
| 11b | Multiple demo-store pages | Update imports |
| 11c | `demo-store/src/app/seller/page.tsx` | Replace with `<SellerDashboard>` |
| 11d | `demo-store/src/app/admin/page.tsx` | Replace with `<AdminDashboard>` |
| 11e | `demo-store/src/app/orders/[id]/page.tsx` | Add `<BuyerChat>` |
| 11f | `demo-store/src/app/product/[id]/page.tsx` | Add `<PayButton>` overlay |
| 12a | `backend/gateway/tsconfig.json` | Create/Update |
| 12a | `backend/gateway/package.json` | Update |

## Architecture Alignment Check

Per `docs/project-breakdown.md` Element 9 (`@flowstate/gateway` package):

| Required Component | Plan Phase | Notes |
|---|---|---|
| `FlowStateProvider` | 8a | Context with apiClient + wsClient |
| `PayButton` (checkout overlay) | 8h | Overlay flow: address → shipping → review → escrow |
| `BuyerChat` (BuyerAgent) | 8e | Floating widget, connected to MCP `buyer_agent_chat` |
| `SellerDashboard` (orders, labels, payouts, SellerAgent chat) | 8f | Embeddable component with 4 tabs + SellerAgent panel |
| `AdminDashboard` (analytics, sellers, AdminAgent chat) | 8g | Embeddable component with 4 tabs + AdminAgent panel |
| `OrderTracker` (7-state FSM widget) | 8c | Real-time via WebSocket |
| `FlowStateServer` (webhook handler) | Already exists | `backend/gateway/server.ts` |
| TypeScript types | 7a | Ported from demo-store simulation types |
| Contract ABIs | Already exist | In `demo-store/src/lib/flowstate/contracts/` |

Per Element 10 (Demo Store integration):

| Required Integration | Plan Phase | Notes |
|---|---|---|
| `<PayButton />` on product pages | 11f | Overlay checkout for single items |
| `<OrderTracker />` in buyer order history | 11b | Import swap |
| `<SellerDashboard />` in seller section | 11c | Drop-in replacement |
| `<AdminDashboard />` in admin section | 11d | Drop-in replacement |
| `<BuyerChat />` on order detail | 11e | Floating widget |
| Wallet connection (MetaMask → XRPL EVM) | Already exists | RainbowKit + wagmi in demo-store |
