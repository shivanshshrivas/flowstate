# Plan: Sub-Components 1–5 Verification, Gap Remediation & Tests

## Context

Verify that gateway sub-components 1–5 are architecturally sound per `architecture.md`. The Solidity contracts are the source of truth for any type/constant mismatches. The `@flowstate/gateway` npm package ships Client SDK + Server SDK + ABIs + Types. The Backend API is deployed separately on cloud and talks to XRPL, Pinata, and Shippo. `demo-store/src/lib/flowstate/` is simulation code — gateway components will be drop-in replacements. AI agents are self-hosted via `mcp-agents/` (MCP server over SSE), NOT Pinata OpenClaw.

---

## TODO Checklist

- [x] **Phase 1**: Fix payout schedule mismatch (contracts → backend)
  - [x] 1a. Update `backend/src/config/constants.ts` — add IN_TRANSIT_BPS, fix FINALIZED_BPS
  - [x] 1b. Update `backend/src/types/sellers.ts` — add `inTransitBps` to PayoutConfig
  - [x] 1c. Update `backend/src/services/shipping.service.ts` — add IN_TRANSIT state transition
  - [x] 1d. Update `backend/src/services/seller.service.ts` — add inTransitBps to defaults + validation
  - [x] 1e. Update `backend/src/services/order.service.ts` — add inTransitBps to payout schedule
  - [x] 1f. Update affected tests to use 5-stage payout schedule
  - [x] 1g. Run `cd backend && npx vitest run` — 108 passing

- [x] **Phase 2**: Fix gateway package barrel export + add server tests
  - [x] 2a. Fix `backend/gateway/index.js` — add missing server re-exports
  - [x] 2b. Add `backend/gateway/__tests__/server.test.ts` — 14 test cases for HMAC verification
  - [x] 2c. Run gateway server tests — 14 passing (added gateway include to vitest.config.ts)

- [x] **Phase 3**: Pinata test files written (deferred — CJS mock issue)
  - [x] 3a–3h. All 6 test files created under `pinata/src/__tests__/`
  - [ ] 3i. Run `cd pinata && npx vitest run` — DEFERRED
  - **Known issue**: vitest cannot intercept transitive CJS `require("./client")` inside source
    files. Tests use `vi.doMock("pinata", ...)` + real env vars. Fix: either convert pinata
    source to ESM, or mock at node_modules boundary and set `PINATA_JWT`/`PINATA_GATEWAY`
    in `.env` for the test run.

- [x] **Phase 4**: Fix stale demo-store ABIs (from Hardhat deployment artifacts)
  - [x] 4a. Update `demo-store/.../EscrowStateMachine.abi.ts` from deployed artifact
  - [x] 4b. Rename `MockRLUSD.abi.ts` → `FLUSD.abi.ts`, export `FLUSDAbi`
  - [x] 4c. Audit call sites — updated faucet/page.tsx and index.ts barrel export
  - [ ] 4d. Run `cd demo-store && npm run build` — DEFERRED (verify after wiring)

- [x] **Phase 5**: Replace agent service — Pinata OpenClaw → self-hosted MCP
  - [x] 5a. Rewrite `backend/src/services/agent.service.ts` — MCP SSE/HTTP client
  - [x] 5b. Update `backend/src/config/env.ts` — replace Pinata agent vars with `MCP_AGENTS_URL`
  - [x] 5c. Agent service test — 7/7 passing (fixed SSE race condition in mock stream)

- [x] **Phase 6**: Wire mcp-agents tools to real backend API — **COMPLETE**
  - [x] 6a–6e. All tools call live backend, mock-data archived

---

## Status: Phases 1-6 COMPLETE

All verification runs passed:
- `cd backend && npx vitest run` → **108 passing**
- Gateway server tests → **14 passing** (added `gateway/__tests__/**/*.test.ts` to vitest.config.ts include)
- Agent service test → **7/7 passing** (fixed SSE race condition: async pull with 10ms delay in mock ReadableStream)

Deferred:
- `cd pinata && npx vitest run` — CJS mock issue (vitest can't intercept transitive `require("./client")`)
- `cd demo-store && npm run build` — verify after gateway SDK wiring (Phase 7+)

---

## NEXT: Phase 7+ (Gateway SDK Wiring)

See `plans/atomic-swinging-tide.md` for the full plan to wire demo-store → gateway SDK → backend API.
