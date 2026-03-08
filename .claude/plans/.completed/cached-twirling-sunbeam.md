# Plan: Cart-Based Checkout Page

## Context

The demo store currently forces buyers to click "Pay with FlowState" on **each individual product page** separately. There is no way to pay for multiple items at once. The cart exists (Zustand store with persistence, shipping address/option storage, subtotal/total computation), the cart page exists, but it just says "Use the Buy with FlowState button on each product page to checkout" — there's no actual checkout flow from the cart.

The architecture doc (`.claude/architecture.md` lines 430-454) shows `PayButton` accepting an `items[]` array and addresses, not a single product. The checkout overlay (`CheckoutOverlay.tsx`) currently takes a single `Product` and creates a mock order for that one item. We need a proper `/checkout` page that checks out the **entire cart**.

**Current flow:** Product page → PayButton → CheckoutOverlay (single product, dialog)
**Target flow:** Cart page → "Proceed to Checkout" → `/checkout` page (full page, all cart items)

## Key Design Decisions

1. **Full page, not a dialog** — The checkout overlay dialog is too small for multi-item orders. The new `/checkout` page is a full-page multi-step flow.
2. **Keep PayButton + CheckoutOverlay for single-item quick-buy** — Don't remove the existing per-product flow; it's useful for impulse buys. The new checkout is the cart-based path.
3. **Group items by seller** — Since each order in FlowState maps to one seller, a multi-seller cart creates multiple orders. The checkout page shows items grouped by seller and creates one order per seller.
4. **Reuse existing stores** — Cart store already has `items`, `shippingAddress`, `shippingOption`, `subtotalUsd()`, `totalUsd()`, `clearCart()`. Order store has `addOrder()`.
5. **Reuse ShippingSelector** — The existing `ShippingSelector` component and `MOCK_SHIPPING_OPTIONS` are reused.
6. **Mock order creation** — Same pattern as CheckoutOverlay (client-side mock order, no real contract calls yet). The `/api/orders` route exists but is unused; keeping consistent with current approach.

## Files to Create (2 new)

### 1. `demo-store/src/app/checkout/page.tsx` — The Checkout Page

Full-page, multi-step checkout. Wrapped in `<RequireRole roles={["buyer"]}>`.

**Steps:** `shipping-address` → `shipping-option` → `review` → `processing` → `success`

**Step 1: Shipping Address**
- Pre-fill from `cartStore.shippingAddress` if previously saved
- Same fields as CheckoutOverlay: name, address1, city, state, zip, country
- On continue: save to `cartStore.setShippingAddress()`

**Step 2: Shipping Option**
- Reuse `<ShippingSelector>` component
- Pre-fill from `cartStore.shippingOption`
- On continue: save to `cartStore.setShippingOption()`

**Step 3: Review Order**
- Show all cart items grouped by seller (each group is a separate order)
- For each seller group: list items with images, names, quantities, line totals
- Show subtotal, shipping, total in USD, and total in FLUSD
- Escrow protection banner (reuse text from CheckoutOverlay)
- "Approve & Pay" button — requires connected wallet (`useAccount`)
- Back button to go to previous step

**Step 4: Processing**
- Spinner + "Processing transaction..." (same as CheckoutOverlay)
- Simulated 2s delay per seller order
- Creates one `Order` per seller group via `orderStore.addOrder()`
- Each order contains its subset of items, its own total, its own escrow mock

**Step 5: Success**
- Green checkmark, "Orders placed successfully!"
- List of created order IDs with links to `/orders/{id}`
- "View Orders" button → `/orders`
- "Continue Shopping" button → `/`
- Calls `cartStore.clearCart()` on reaching this step

**Key implementation details:**
- Group cart items by `product.seller_id` using a helper: `Map<string, CartItem[]>`
- Each seller group gets its own subtotal; shipping is applied once to the overall order
- Order ID generation: reuse `generateOrderId()` pattern from CheckoutOverlay
- Payout schedule: same 5-tier schedule as CheckoutOverlay (1500/1500/2000/3500/1500 bps)
- Empty cart → redirect to `/cart` with a message

### 2. `demo-store/src/components/checkout/CheckoutSteps.tsx` — Step indicator

A simple horizontal step indicator showing the 4 user-visible steps (shipping address → shipping method → review → complete). Highlights current step, shows completed steps with checkmarks.

## Files to Modify (2 existing)

### 3. `demo-store/src/app/cart/page.tsx` — Add "Proceed to Checkout" button

Currently the cart page's summary section says:
```
Use the Buy with FlowState button on each product page to checkout.
```

Replace that text + "Continue Shopping" button with:
- **"Proceed to Checkout" button** — primary, links to `/checkout`. Disabled if cart is empty. Requires connected wallet (show "Connect Wallet to Checkout" if disconnected).
- Keep "Continue Shopping" as secondary/outline button below it
- Remove the "Use the Buy with FlowState button..." text

Also the empty cart state links back to `/` which is fine.

### 4. `demo-store/src/components/checkout/ShippingSelector.tsx` — No changes needed

Already works as a standalone component accepting `selected` and `onSelect` props. Reuse as-is.

## Implementation Sequence

1. Create `CheckoutSteps.tsx` — step indicator component (no dependencies)
2. Create `checkout/page.tsx` — main checkout page
3. Modify `cart/page.tsx` — add "Proceed to Checkout" button, remove "use PayButton" text

## Critical Files Reference

| File | Role |
|------|------|
| `demo-store/src/stores/cart-store.ts` | Cart state: items, shipping, totals, clearCart |
| `demo-store/src/stores/order-store.ts` | `addOrder()` to persist created orders |
| `demo-store/src/components/checkout/CheckoutOverlay.tsx` | Reference for order creation mock logic (lines 80-146) |
| `demo-store/src/components/checkout/ShippingSelector.tsx` | Reuse for shipping option selection |
| `demo-store/src/components/guards/RequireRole.tsx` | Wrap checkout page for buyer-only access |
| `demo-store/src/lib/flowstate/types/index.ts` | Order, OrderItem, ShippingOption, ShippingAddress, OrderState types |
| `demo-store/src/lib/utils.ts` | `formatUsd()`, `formatToken()` |
| `demo-store/src/lib/mock-data.ts` | `MOCK_SHIPPING_OPTIONS` |

## Verification

1. **Cart → Checkout flow**: Add items to cart → go to cart page → click "Proceed to Checkout" → arrives at `/checkout`
2. **Empty cart guard**: Visit `/checkout` with empty cart → redirected to `/cart`
3. **Shipping address step**: Fill in address → stored in cart store → persists on back/refresh
4. **Shipping option step**: Select shipping option → continue to review
5. **Review step**: All cart items shown grouped by seller → totals correct (subtotal + shipping) → FLUSD amount shown
6. **Wallet required**: "Approve & Pay" disabled without wallet connection
7. **Order creation**: Click pay → processing spinner → orders created in order store (one per seller) → success page shows order IDs
8. **Cart cleared**: After success, cart is empty
9. **Role guard**: Seller visiting `/checkout` is redirected to `/seller`; unauthenticated to `/auth/login`
10. **Single-item flow preserved**: PayButton on product pages still works independently via CheckoutOverlay
