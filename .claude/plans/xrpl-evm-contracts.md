# FlowState — XRPL EVM Smart Contracts Implementation Plan

## Context

FlowState is a blockchain-based escrow checkout system for e-commerce. The XRPL EVM block consists of Solidity smart contracts deployed to the XRPL EVM Sidechain Testnet that handle: a mock stablecoin (FLUSD) for payments, a 7-state escrow FSM with streaming payouts, dispute resolution, and payment splitting (partial releases, platform fees, refunds). These contracts will be consumed by a separate backend API via ethers.js v6.

---

## Architectural Decisions

### Token Custody
EscrowStateMachine contract holds all escrowed tokens. Buyer calls `FLUSD.approve(escrow, amount)` from their wallet, then the operator (backend wallet) calls `createEscrow()` which pulls tokens via `transferFrom`.

### PaymentSplitter → Merged into EscrowStateMachine
Instead of a separate PaymentSplitter contract, the payment logic (`_releasePartial`, `_releaseFinal`, `_refundBuyer`) lives as internal functions inside EscrowStateMachine. This avoids an extra deployment, extra approvals, and cross-contract gas overhead. **3 deployed contracts total: FLUSD, EscrowStateMachine, DisputeResolver.**

### Contract Interaction Pattern
One-directional dependency: `DisputeResolver → EscrowStateMachine`. When a dispute is resolved, DisputeResolver calls `EscrowStateMachine.executeResolution(escrowId, refundBps)`. EscrowStateMachine never calls DisputeResolver.

### Token Standard
Uses OpenZeppelin's `SafeERC20` for all token operations (future-proofs for real RLUSD swap). Custom errors instead of revert strings.

---

## Directory Structure

```
flowstate/
├── packages/
│   └── contracts/                       ← Hardhat project root
│       ├── contracts/
│       │   ├── FLUSD.sol                 (~30 lines)
│       │   ├── EscrowStateMachine.sol    (~350 lines, includes PaymentSplitter logic)
│       │   ├── DisputeResolver.sol       (~200 lines)
│       │   └── interfaces/
│       │       ├── IEscrowStateMachine.sol
│       │       └── IDisputeResolver.sol
│       ├── test/
│       │   ├── FLUSD.test.ts
│       │   ├── EscrowStateMachine.test.ts
│       │   ├── DisputeResolver.test.ts
│       │   ├── integration/
│       │   │   └── FullLifecycle.test.ts
│       │   └── helpers/
│       │       ├── fixtures.ts
│       │       ├── constants.ts
│       │       └── time.ts
│       ├── ignition/
│       │   └── modules/
│       │       └── FullDeploy.ts
│       ├── scripts/
│       │   ├── seed.ts                   (mint FLUSD to demo wallets)
│       │   └── demo-flow.ts             (run happy-path on testnet)
│       ├── hardhat.config.ts
│       ├── package.json
│       ├── tsconfig.json
│       ├── .env.example
│       └── .gitignore
```

---

## Contract Specifications

### 1. FLUSD.sol

| Field | Value |
|-------|-------|
| Name | "Flow USD" |
| Symbol | "FLUSD" |
| Decimals | 6 |
| Faucet | `faucet()` → mints 50,000 FLUSD to msg.sender |
| Owner Mint | `mint(address, uint256)` → onlyOwner |
| Base | OpenZeppelin ERC20 + Ownable |

### 2. EscrowStateMachine.sol (Core)

**States:**
```
INITIATED(0) → ESCROWED(1) → LABEL_CREATED(2) → SHIPPED(3) → IN_TRANSIT(4) → DELIVERED(5) → FINALIZED(6)
                                                                                                    ↕
                                                                                              DISPUTED(7)
```

**Escrow Struct:**
- `bytes32 orderId`, `address buyer`, `address seller`, `address token`
- `uint128 totalAmount`, `uint128 releasedAmount`, `uint128 frozenAmount`
- `uint64 deliveredAt`, `uint64 gracePeriod`
- `State state`, `uint16[5] payoutBps`

**Default Payout Schedule (basis points, sum = 10000):**
| Transition | BPS | % |
|---|---|---|
| ESCROWED → LABEL_CREATED | 1500 | 15% |
| LABEL_CREATED → SHIPPED | 1500 | 15% |
| SHIPPED → IN_TRANSIT | 2000 | 20% |
| IN_TRANSIT → DELIVERED | 3500 | 35% |
| DELIVERED → FINALIZED | 1500 | 15% (holdback) |

Platform fee: 250 bps (2.5%) deducted from holdback at finalization.
Grace period: 3 days (configurable).

**Functions:**

| Function | Access | Description |
|---|---|---|
| `createEscrow(orderId, buyer, seller, token, amount, payoutBps)` | operator | Pulls tokens from buyer, creates escrow |
| `advanceState(escrowId)` | operator | Next state, releases payout to seller |
| `initiateDispute(escrowId, evidenceCid)` | operator | Freezes remaining, sets DISPUTED |
| `finalize(escrowId)` | operator | After grace period, releases holdback - fee |
| `executeResolution(escrowId, refundBps)` | disputeResolver only | Refund/release/split |
| `getEscrow(escrowId)` | view | Returns Escrow struct |
| `getEscrowByOrderId(orderId)` | view | Lookup by order ID |
| Config setters | owner | setOperator, setDisputeResolver, setPlatformFeeWallet, setPlatformFeeBps, setDefaultGracePeriod |

**Security:** ReentrancyGuard, Pausable, SafeERC20, custom errors.

### 3. DisputeResolver.sol

**Dispute States:** `OPEN → RESPONDED → UNDER_REVIEW → RESOLVED`
**Outcomes:** `REFUND_BUYER`, `RELEASE_SELLER`, `SPLIT`
**Seller Response Window:** 72 hours

**Functions:**

| Function | Access | Description |
|---|---|---|
| `createDispute(escrowId, buyerEvidenceCid)` | operator | Calls ESM.initiateDispute, records dispute |
| `respondToDispute(disputeId, sellerEvidenceCid)` | operator | Seller submits counter-evidence |
| `resolveDispute(disputeId, outcome, refundBps)` | admin | Admin manual resolution |
| `autoResolve(disputeId)` | anyone | After 72h timeout, auto-refund buyer 100% |
| `getDispute(disputeId)` | view | Returns Dispute struct |

---

## Cross-Contract Permissions (Post-Deploy Setup)

```
1. EscrowStateMachine.setOperator(backendWallet)
2. EscrowStateMachine.setDisputeResolver(disputeResolverAddress)
3. EscrowStateMachine.setPlatformFeeWallet(feeWallet)
4. DisputeResolver.setOperator(backendWallet)
5. DisputeResolver.setAdmin(adminWallet)
```

---

## Testing Plan (~85 tests)

| Test File | Tests | Focus |
|---|---|---|
| `FLUSD.test.ts` | ~15 | Decimals, faucet, owner mint, ERC-20 ops |
| `EscrowStateMachine.test.ts` | ~40 | Create escrow, state transitions, payout math, finalization, dispute interface, access control |
| `DisputeResolver.test.ts` | ~20 | Create dispute, respond, resolve, auto-resolve, timeout checks |
| `FullLifecycle.test.ts` | ~10 | End-to-end happy path, dispute paths, edge cases |

**Test helpers:** Shared fixture (`deployFullSuite()`), constants, time manipulation (`evm_increaseTime`).

---

## Deployment

**Target:** XRPL EVM Sidechain Testnet (Chain ID: 1449000, RPC: `https://rpc.testnet.xrplevm.org`)
**Tool:** Hardhat Ignition (deterministic deployments)
**Order:** FLUSD → EscrowStateMachine → DisputeResolver → Config setup → Seed tokens

---

## Build Phases

| # | Phase | Est. Time | Deliverable |
|---|---|---|---|
| 1 | Project scaffolding | 30 min | Hardhat project, config, directory structure |
| 2 | FLUSD token | 1 hr | Contract + tests + ignition module |
| 3 | ESM — Interfaces & structs | 1 hr | IEscrowStateMachine.sol with all types |
| 4 | ESM — Core (create + config) | 2 hr | createEscrow + admin setters + tests |
| 5 | ESM — State transitions | 2 hr | advanceState + finalize + payout math + tests |
| 6 | ESM — Dispute interface | 1 hr | initiateDispute + executeResolution + tests |
| 7 | DisputeResolver | 2-3 hr | Full contract + tests |
| 8 | Integration tests | 1-2 hr | FullLifecycle.test.ts |
| 9 | Deployment & testnet | 1-2 hr | Ignition modules, seed script, demo-flow script |
| 10 | ABI export | 30 min | Copy ABIs to shared location |
| **Total** | | **~12-16 hrs** | |

---

## Verification

1. `npx hardhat test` — all ~85 tests pass
2. `npx hardhat ignition deploy ignition/modules/FullDeploy.ts` — deploys locally
3. `npx hardhat ignition deploy --network xrplEvmTestnet` — deploys to XRPL EVM testnet
4. `npx hardhat run scripts/seed.ts --network xrplEvmTestnet` — mints FLUSD to demo wallets
5. `npx hardhat run scripts/demo-flow.ts --network xrplEvmTestnet` — runs full happy-path on testnet
6. Verify contract addresses on explorer: `https://explorer.testnet.xrplevm.org`
