# Implement BullMQ, WebSocket Event Bus, Cron Scheduler + Test Suite

## Context

The FlowState backend has 8 endpoint groups wired up but zero orchestration infrastructure. Currently:
- Events are dispatched via an in-process typed `EventEmitter` (4 event types, only 2 have listeners)
- Webhook delivery is synchronous, sequential, with no retries (`WebhookService.dispatch()`)
- Blockchain calls + IPFS pins run inline in request handlers (slow, fragile)
- No Redis, no job queue, no WebSocket, no cron, no tests

The architecture spec calls for a **BullMQ job queue**, **WebSocket Event Bus**, and **Cron scheduler** as the orchestration layer between the API routes and data stores. We also need a test suite built from scratch.

---

## New Dependencies

**Production:**
- `bullmq` — job queue with exponential backoff retries, repeatable jobs
- `ioredis` — Redis client (BullMQ peer dep)
- `@fastify/websocket` — WebSocket support on Fastify's HTTP server

**Dev:**
- `vitest` — TypeScript-native test framework
- `@vitest/coverage-v8` — code coverage

---

## Phase 1: Test Infrastructure (first — enables TDD for phases 2-4)

### New Files

**`vitest.config.ts`** (project root)
- `include: ['src/**/*.test.ts']`, `globals: true`, `environment: 'node'`

**`src/__tests__/helpers/mocks.ts`** — Shared mock factories
- `createMockShippoBridge()` — `vi.fn()` for all 4 `IShippoBridge` methods
- `createMockPinataBridge()` — `vi.fn()` for all 3 `IPinataBridge` methods
- `createMockBlockchainBridge()` — `vi.fn()` for all 8 `IBlockchainBridge` methods
- `createMockDb()` — mock drizzle chain calls (select/from/where/limit/insert/update/returning)

**`src/__tests__/helpers/fixtures.ts`** — Test data factories
- `makeOrder(overrides?)`, `makeSeller(overrides?)`, `makeDispute(overrides?)`, `makePayout(overrides?)`, `makeProject(overrides?)`, `makeApiKey(overrides?)`

**`src/__tests__/helpers/app.ts`** — Fastify test app builder
- `buildTestApp(serviceOverrides?)` — creates Fastify instance with routes registered, returns `app` for `app.inject()` testing

### Test Files

| File | What It Tests |
|------|---------------|
| `src/services/__tests__/order.service.test.ts` | create, selectShipping, confirmEscrow, confirmLabelPrinted, finalize — happy paths + all error branches (wrong state, not found, wallet mismatch, grace period) |
| `src/services/__tests__/shipping.service.test.ts` | processWebhook (SHIPPED/DELIVERED paths), getRates, getTracking |
| `src/services/__tests__/dispute.service.test.ts` | create (in/out grace), respond (accept/contest), resolve |
| `src/services/__tests__/seller.service.test.ts` | onboard (valid/invalid bps), getOrders, getMetrics, getPayouts |
| `src/services/__tests__/payout.service.test.ts` | recordPayout, getSellerPayouts |
| `src/services/__tests__/webhook.service.test.ts` | dispatch (multiple regs, event filtering, network errors, HMAC signature) |
| `src/services/__tests__/auth.service.test.ts` | createProject, rotateApiKey |
| `src/services/__tests__/platform.service.test.ts` | getAnalytics, getSellers (flagged filter), getGasCosts |
| `src/routes/__tests__/orders.routes.test.ts` | Fastify inject: Zod validation, auth rejection, success responses |
| `src/routes/__tests__/auth.routes.test.ts` | project creation (no auth), key rotation (with auth) |

### Mocking Strategy
- **DB**: `vi.mock('../../db/client')` at file level — mock the `db` export with chainable query builder
- **Bridges**: Constructor-injected interfaces — pass mock objects directly to service constructors
- **Fetch**: `vi.spyOn(globalThis, 'fetch')` for webhook delivery + agent tests
- **EventEmitter**: Import real `flowStateEmitter`, attach `vi.fn()` listeners, verify emissions

### Modified Files
- **`package.json`** — add `vitest`, `@vitest/coverage-v8` to devDeps; add scripts: `"test": "vitest run"`, `"test:watch": "vitest"`, `"test:coverage": "vitest run --coverage"`

---

## Phase 2: Redis + BullMQ Job Queue

### New Files

**`src/queue/redis.ts`** — Redis connection singleton
- `createRedisConnection(url?: string): IORedis | null` — returns `null` when REDIS_URL absent
- `getRedisConnection()` — singleton getter
- Handles Upstash (TLS) and local Redis URLs

**`src/queue/queues.ts`** — Queue definitions
- Exports `webhookDeliveryQueue`, `stateTransitionQueue`, `agentRoutingQueue` (BullMQ `Queue` instances)
- Only instantiated if `getRedisConnection()` returns non-null
- Exports `queuesAvailable(): boolean` helper

**`src/queue/workers/webhook-delivery.worker.ts`**
- Job data: `{ registrationId, projectId, eventType, payload, body, secret, url }`
- Logic: sign payload, HTTP POST, log result — extracted from `WebhookService` lines 35-69
- BullMQ retry config: exponential backoff, 5 attempts, initial delay 5000ms
- One job per registration (independent retries per endpoint)

**`src/queue/workers/state-transition.worker.ts`**
- Job data: `{ orderId, projectId, targetState, contractOrderId, escrowAmountToken, payoutBps, sellerId, trackingNumber }`
- Logic: IPFS pin + blockchain advanceState + releasePartial + DB update + payout recording — extracted from `ShippingService.processWebhook()` lines 91-148
- Idempotent: re-reads order state before acting, skips if already advanced

**`src/queue/workers/agent-routing.worker.ts`**
- Job data: `{ projectId, role, userId, message }`
- Logic: calls `AgentService.chat()`, pushes response via WebSocket `broadcastToProject()`

**`src/queue/workers/index.ts`** — Worker bootstrap
- `startWorkers(deps)` — creates all three Worker instances, called only if Redis available

### Modified Files

**`src/config/env.ts`** — Add `REDIS_URL: z.string().optional()`

**`src/services/webhook.service.ts`** — Extract single-registration delivery
- New method: `deliverToRegistration(reg, eventType, payload): Promise<{ statusCode, responseBody }>` (extracted from the for-loop body)
- `dispatch()` keeps working as the non-Redis fallback path
- New method: `enqueueDispatch(projectId, eventType, payload)` — queries registrations, adds one BullMQ job per registration

**`src/services/shipping.service.ts`** — Optional queue offload
- In `processWebhook()`, when `queuesAvailable()`, replace lines 91-148 with `stateTransitionQueue.add(...)`
- When Redis unavailable, keep current inline behavior

**`src/index.ts`** — Wire up Redis + queues + workers
- Initialize Redis connection
- If available: create queues, start workers
- Modify emitter listeners to use `enqueueDispatch()` when queues available
- Wire the two unwired events (`dispute:resolved`, `payout:recorded`) to webhook dispatch

### Test Files
- `src/queue/__tests__/webhook-delivery.worker.test.ts` — mock fetch, verify retry config, log recording
- `src/queue/__tests__/state-transition.worker.test.ts` — mock bridges, verify idempotency

---

## Phase 3: WebSocket Event Bus

### New Files

**`src/ws/types.ts`** — Message type definitions
```
WsIncoming: { type: "auth", token: string } | { type: "ping" }
WsOutgoing: { type: "order_state_changed", data: ... }
          | { type: "escrow_created", data: ... }
          | { type: "dispute_created", data: ... }
          | { type: "chat_response", data: ... }
          | { type: "pong" }
          | { type: "error", message: string }
```

**`src/ws/index.ts`** — WebSocket plugin for Fastify
- Registers `@fastify/websocket`
- `/ws` route upgrades connections
- Auth flow: client sends `{ type: "auth", token: "<api_key>" }` within 5s, server validates via `hashApiKey` + DB lookup, stores socket in `Map<projectId, Set<WebSocket>>`
- Export `broadcastToProject(projectId, event, data)` — sends to all connected sockets for that project
- Handles disconnect cleanup + ping/pong keepalive

### Modified Files

**`src/index.ts`** — Register WS plugin, add emitter listeners:
- `order:state_changed` → `broadcastToProject(projectId, "order_state_changed", data)`
- `dispute:created` → `broadcastToProject(projectId, "dispute_created", data)`
- `payout:recorded` → `broadcastToProject(projectId, "payout_released", data)`

**`src/events/emitter.ts`** — No changes needed (existing 4 events cover all WS broadcast needs)

### Test Files
- `src/ws/__tests__/ws.test.ts` — Auth handshake, project-scoped broadcast, disconnect cleanup

---

## Phase 4: Cron Scheduler (BullMQ Repeatable Jobs)

### New Files

**`src/cron/scheduler.ts`** — Cron job definitions
- Uses BullMQ repeatable jobs on a `cronQueue` (same Redis connection)
- Two repeatable jobs:
  1. **`auto-finalize`** (every 15 min): Query `orders WHERE state = 'DELIVERED' AND grace_ends_at < NOW()`, cross-check no OPEN dispute exists in `disputes` for that order, call `OrderService.finalize()` for each
  2. **`dispute-auto-resolve`** (every 30 min): Query `disputes WHERE status = 'OPEN' AND seller_deadline < NOW()`, call `blockchainBridge.refundBuyer()`, update dispute to `AUTO_RESOLVED`
- Fallback: when Redis unavailable, use `setInterval` with same logic

**`src/cron/cron.worker.ts`** — BullMQ worker for cron queue
- Dispatches to correct handler based on job name
- Accepts bridges + services via closure (injected at startup)

### Modified Files

**`src/index.ts`** — Call `startCronJobs()` during bootstrap if Redis available, otherwise start setInterval fallback

### Test Files
- `src/cron/__tests__/scheduler.test.ts` — Mock DB to return qualifying orders/disputes, verify finalize/refund is called correctly

---

## Phase 5: Integration Wiring

All changes converge in **`src/index.ts`**:

```
bootstrap():
  1. Create bridges (existing)
  2. Create services (existing)
  3. Initialize Redis connection (new)
  4. If Redis available:
     a. Create queues
     b. Start workers (pass bridges + services)
     c. Start cron jobs
  5. Create Fastify app (existing)
  6. Register WS plugin (new)
  7. Register routes (existing)
  8. Wire emitter listeners:
     - order:state_changed → webhook dispatch (queue or inline) + WS broadcast
     - dispute:created → webhook dispatch + WS broadcast
     - dispute:resolved → webhook dispatch (NEW - currently unwired)
     - payout:recorded → webhook dispatch (NEW - currently unwired)
  9. Start server (existing)
```

---

## Implementation Order

1. Install deps: `npm i bullmq ioredis @fastify/websocket` + `npm i -D vitest @vitest/coverage-v8`
2. `vitest.config.ts` + test helpers (mocks, fixtures, app builder)
3. Unit tests for existing services (validates current behavior)
4. `src/config/env.ts` — add `REDIS_URL`
5. `src/queue/redis.ts` + `src/queue/queues.ts`
6. `src/services/webhook.service.ts` — refactor to extract `deliverToRegistration()`
7. `src/queue/workers/webhook-delivery.worker.ts` + tests
8. `src/queue/workers/state-transition.worker.ts` + tests
9. `src/queue/workers/agent-routing.worker.ts`
10. `src/queue/workers/index.ts`
11. `src/ws/types.ts` + `src/ws/index.ts` + tests
12. `src/cron/scheduler.ts` + `src/cron/cron.worker.ts` + tests
13. `src/index.ts` — wire everything together
14. Route integration tests
15. Full typecheck + test run

---

## Verification

1. `npm run typecheck` — zero errors
2. `npm run test` — all tests pass
3. `npm run test:coverage` — 80%+ services, 70%+ routes
4. Start without `REDIS_URL` — app works with graceful degradation (sync fallback)
5. Start with `REDIS_URL` (local Redis or Upstash) — jobs enqueue and process, WS connections receive broadcasts, cron jobs fire on schedule

---

## Key Design Decisions

1. **Emitter stays as internal bus** — services emit events, listeners in `index.ts` decide whether to queue jobs or run inline. Services stay decoupled from infrastructure.
2. **Graceful degradation** — all queue/cron/WS features check `queuesAvailable()`. Without Redis, everything falls back to current synchronous behavior.
3. **One BullMQ job per webhook registration** — independent retry per endpoint; a slow/failing URL doesn't block others.
4. **Idempotent workers** — state-transition worker re-reads order state before acting; skips if already advanced.
5. **WS auth via first message** — client sends `{ type: "auth", token }` within 5s (avoids API key in URL/logs).
6. **BullMQ repeatable jobs for cron** — one fewer dependency (no node-cron), uses same Redis connection.
7. **Tests don't need real DB or Redis** — all mocked via vi.mock/vi.fn, bridges are interface-injected.

---

## Critical Files

| File | Action |
|------|--------|
| `src/index.ts` | Major changes — wire Redis, queues, workers, WS, cron, new emitter listeners |
| `src/services/webhook.service.ts` | Refactor — extract `deliverToRegistration()`, add `enqueueDispatch()` |
| `src/services/shipping.service.ts` | Modify `processWebhook()` — optional queue offload |
| `src/config/env.ts` | Add `REDIS_URL` optional env var |
| `src/events/emitter.ts` | No changes needed |
| `package.json` | Add deps + test scripts |
