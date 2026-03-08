# Plan: Shippo/Gateway Tests + Pinata Gateway Integration

## Context

The `shippo/` service was just connected to the backend gateway via direct import (no HTTP). Now we need:

1. **Tests** for the shippo service (unit-level) and the backend bridge (delegation tests), plus a test infrastructure pattern for future integration bridges
2. **Pinata gateway integration** — the `pinata/` service has 6 standalone functions for IPFS pinning (invoices, labels, receipts, evidence). The backend has a `PinataBridgeStub` returning fake CIDs. We need to replace the stub with real delegation to the pinata module, mirroring the shippo integration pattern.

**Excluded**: All agentic AI workflows (Workflows 4, 6, and the agent portions of Workflow 5). No `pinata-agents/` or `pinata-mcp/` work. We only implement human-centered IPFS pinning.

---

## Part A: Tests

### Step A1: Shippo service unit tests

**File: `shippo/src/__tests__/tracking.test.js`** (new)

Test `mapToEscrowEvent()` — pure function, no mocking needed:

- `PRE_TRANSIT` → `{ escrowEvent: "LABEL_SCANNED", shouldAdvance: false }`
- `TRANSIT` (no substatus) → `{ escrowEvent: "SHIPPED", shouldAdvance: true }`
- `TRANSIT` + `out_for_delivery` → `{ escrowEvent: "OUT_FOR_DELIVERY", shouldAdvance: false }`
- `DELIVERED` → `{ escrowEvent: "DELIVERED", shouldAdvance: true }`
- `RETURNED` → `{ escrowEvent: "RETURN_INITIATED", shouldAdvance: false }`
- `FAILURE` → `{ escrowEvent: "DELIVERY_FAILED", shouldAdvance: false }`
- `UNKNOWN` → `{ escrowEvent: null, shouldAdvance: false }`
- unrecognized string → `{ escrowEvent: null, shouldAdvance: false }`

**File: `shippo/src/__tests__/webhook.test.js`** (new)

Test `handleShippoWebhook()` — pure function (no SDK calls):

- `event !== "track_updated"` → `{ handled: false }`
- Missing `tracking_number` → `{ handled: false }`
- Valid `track_updated` with `TRANSIT` status → correct `escrowEvent`, `shouldAdvance`, and `substatus` extraction (`.substatus.code`, not raw object)
- Valid `track_updated` with `DELIVERED` → `{ escrowEvent: "DELIVERED", shouldAdvance: true }`

**File: `shippo/src/__tests__/rates.test.js`** (new)

Test `getShippingRates()` — mock `getClient()` to return a fake Shippo client:

- Successful shipment → returns `{ shipmentId, rates[] }` with correct field mapping (`rateId`, `carrier`, `service`, `days`, `amountUSD`, `currency`)
- Failed shipment (status !== "SUCCESS") → throws

**File: `shippo/src/__tests__/labels.test.js`** (new)

Test `purchaseLabel()` — mock `getClient()`:

- Successful transaction → returns all fields including `shippingCostUsd`
- Failed transaction → throws with message text

**File: `shippo/package.json`** — add vitest as devDependency, add `"test": "vitest run"` script.

**File: `shippo/vitest.config.js`** (new) — minimal config: `{ test: { globals: true } }`.

### Step A2: Backend bridge delegation tests

**File: `backend/src/bridges/__tests__/shippo.bridge.test.ts`** (new)

Test that `ShippoBridgeImpl` delegates correctly to the shippo module:

- Mock `../../../shippo/src` using `vi.mock()`
- `constructor()` calls `shippoLib.initialize(apiKey)`
- `getRates()` calls `shippoLib.getShippingRates()` and returns its result
- `purchaseLabel()` calls `shippoLib.purchaseLabel()` and returns its result
- `getTrackingStatus()` calls `shippoLib.getTrackingStatus()` and returns its result
- `handleWebhook()` calls `shippoLib.handleShippoWebhook()` and returns its result
- `mapToEscrowEvent()` (standalone export) calls `shippoLib.mapToEscrowEvent()`

**File: `backend/vitest.config.ts`** — add `"src/bridges/**/*.test.ts"` and `"src/services/**/*.test.ts"` to the `include` array so all test suites run.

### Step A3: Integration test pattern for future bridges

**File: `backend/src/bridges/__tests__/README.md`** (new)

Short doc (< 30 lines) establishing the pattern:
- Bridge tests mock the external module (`vi.mock("../../../<service>/src")`)
- Verify each bridge method delegates to the correct module function
- Verify constructor passes config (API key, JWT, etc.)
- Real integration tests (hitting live APIs) go in a separate `__integration__/` directory with `.integration.test.ts` suffix and are excluded from CI

---

## Part B: Pinata Gateway Integration

Mirror the shippo integration pattern exactly.

### Step B1: Create module entrypoint for pinata service

**File: `pinata/src/index.js`** (new)

```js
const { pinInvoice } = require("./invoices");
const { pinShippingLabel } = require("./labels");
const { pinTrackingReceipt, pinPayoutReceipt } = require("./receipts");
const { pinEvidenceFile, pinEvidenceBundle } = require("./evidence");

let _initialized = false;

function initialize(jwt, gateway) {
  const { initClient } = require("./client");
  initClient(jwt, gateway);
  _initialized = true;
}

function getGatewayUrl(cid) {
  const { gatewayUrl } = require("./client");
  return gatewayUrl(cid);
}

module.exports = {
  initialize,
  pinInvoice,
  pinShippingLabel,
  pinTrackingReceipt,
  pinPayoutReceipt,
  pinEvidenceFile,
  pinEvidenceBundle,
  getGatewayUrl,
};
```

### Step B2: Refactor `pinata/src/client.js` for lazy-init

Replace eager `require("dotenv").config()` + singleton with the same lazy-init factory pattern used for shippo:

```js
const { PinataSDK } = require("pinata");

let _client = null;
let _gateway = null;

function initClient(jwt, gateway) {
  _client = new PinataSDK({ pinataJwt: jwt, pinataGateway: gateway });
  _gateway = gateway;
}

function getClient() {
  if (!_client) {
    require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
    if (!process.env.PINATA_JWT) throw new Error("PINATA_JWT missing");
    if (!process.env.PINATA_GATEWAY) throw new Error("PINATA_GATEWAY missing");
    _client = new PinataSDK({
      pinataJwt: process.env.PINATA_JWT,
      pinataGateway: process.env.PINATA_GATEWAY,
    });
    _gateway = process.env.PINATA_GATEWAY;
  }
  return _client;
}

function gatewayUrl(cid) {
  if (!_gateway) getClient(); // ensure initialized
  return `https://${_gateway}/ipfs/${cid}`;
}

module.exports = { initClient, getClient, gatewayUrl };
```

### Step B3: Update pinata source files to use `getClient()`

**Files: `invoices.js`, `labels.js`, `receipts.js`, `evidence.js`**

Each currently imports `{ pinata, gatewayUrl }` from `./client`. Change to:
- `const { getClient, gatewayUrl } = require("./client");`
- Inside each async function body: `const pinata = getClient();`

### Step B4: Update `pinata/package.json`

Change `"main"` from `"index.js"` to `"src/index.js"`.

### Step B5: Add TypeScript declarations

**File: `pinata/src/index.d.ts`** (new)

Declare all exported functions with their parameter/return types for backend type safety.

### Step B6: Add `PINATA_JWT` and `PINATA_GATEWAY` to backend env schema

**File: `backend/src/config/env.ts`**

Add to the Zod schema:
```typescript
PINATA_JWT: z.string().optional(),
PINATA_GATEWAY: z.string().optional(),
```

### Step B7: Expand `IPinataBridge` and replace stub with real implementation

**File: `backend/src/bridges/pinata.bridge.ts`**

The current `IPinataBridge` interface has only 3 methods (`pinJSON`, `pinFile`, `getGatewayUrl`) — these are simplified abstractions. The pinata module has richer, domain-specific functions. The backend services currently only call `pinJSON`, `pinFile`, and `getGatewayUrl`, so the interface stays the same but the implementation delegates:

```typescript
const pinataLib = require("../../../pinata/src");
import { env } from "../config/env";

export interface IPinataBridge {
  pinJSON(data: unknown, name: string): Promise<string>;
  pinFile(fileUrl: string, name: string): Promise<string>;
  getGatewayUrl(cid: string): string;
}

export class PinataBridgeImpl implements IPinataBridge {
  constructor(jwt?: string, gateway?: string) {
    if (jwt && gateway) {
      pinataLib.initialize(jwt, gateway);
    } else if (env.PINATA_JWT && env.PINATA_GATEWAY) {
      pinataLib.initialize(env.PINATA_JWT, env.PINATA_GATEWAY);
    }
    // If neither provided, pinata module falls back to its own .env
  }

  async pinJSON(data: unknown, name: string): Promise<string> {
    const result = await pinataLib.pinInvoice
      ? // Use the SDK directly for generic JSON pinning
        this._pinGenericJSON(data, name)
      : "";
    return result;
  }
  // ...
}
```

**Wait** — the backend services call `pinJSON(data, name)` and `pinFile(fileUrl, name)` generically. The pinata module's functions are domain-specific (`pinInvoice`, `pinShippingLabel`, etc.). These don't map 1:1. The bridge needs to either:

**(a) Keep generic `pinJSON`/`pinFile` by exposing lower-level SDK wrappers from pinata**, or
**(b) Expand the interface to use domain-specific methods**

Option (a) is simpler and minimally invasive — add two generic helpers to the pinata module:

```js
// pinata/src/generic.js
async function pinJSON(data, name) {
  const pinata = getClient();
  const result = await pinata.upload.json(data).addMetadata({ name, keyValues: {} });
  return result.cid;
}

async function pinFile(fileUrl, name) {
  const fetch = require("node-fetch");
  const response = await fetch(fileUrl);
  const buffer = await response.buffer();
  const file = new File([buffer], name, { type: "application/octet-stream" });
  const result = await pinata.upload.file(file).addMetadata({ name, keyValues: {} });
  return result.cid;
}
```

This preserves the existing `IPinataBridge` interface, existing service code, and existing tests.

### Step B8: Backend bootstrap — instantiate `PinataBridgeImpl`

**File: `backend/src/index.ts`** (or wherever bridges are instantiated)

Change `new PinataBridgeStub()` to `new PinataBridgeImpl()`. Constructor reads `PINATA_JWT` and `PINATA_GATEWAY` from `env`.

### Step B9: Bridge delegation test

**File: `backend/src/bridges/__tests__/pinata.bridge.test.ts`** (new)

Same pattern as shippo bridge test:
- Mock `../../../pinata/src`
- Verify `PinataBridgeImpl` constructor calls `pinataLib.initialize()`
- Verify `pinJSON()` delegates correctly
- Verify `pinFile()` delegates correctly
- Verify `getGatewayUrl()` delegates correctly

---

## Files Modified/Created

| File | Action |
|------|--------|
| **Tests — Shippo** | |
| `shippo/src/__tests__/tracking.test.js` | **Create** — mapToEscrowEvent tests |
| `shippo/src/__tests__/webhook.test.js` | **Create** — handleShippoWebhook tests |
| `shippo/src/__tests__/rates.test.js` | **Create** — getShippingRates tests (mocked SDK) |
| `shippo/src/__tests__/labels.test.js` | **Create** — purchaseLabel tests (mocked SDK) |
| `shippo/package.json` | **Edit** — add vitest devDep + test script |
| `shippo/vitest.config.js` | **Create** — minimal vitest config |
| **Tests — Backend bridge** | |
| `backend/src/bridges/__tests__/shippo.bridge.test.ts` | **Create** — delegation tests |
| `backend/src/bridges/__tests__/pinata.bridge.test.ts` | **Create** — delegation tests |
| `backend/src/bridges/__tests__/README.md` | **Create** — integration test pattern doc |
| `backend/vitest.config.ts` | **Edit** — add bridges + services to include |
| **Pinata integration** | |
| `pinata/src/index.js` | **Create** — module entrypoint |
| `pinata/src/index.d.ts` | **Create** — TypeScript declarations |
| `pinata/src/client.js` | **Edit** — lazy-init factory |
| `pinata/src/generic.js` | **Create** — generic pinJSON/pinFile wrappers |
| `pinata/src/invoices.js` | **Edit** — use `getClient()` |
| `pinata/src/labels.js` | **Edit** — use `getClient()` |
| `pinata/src/receipts.js` | **Edit** — use `getClient()` |
| `pinata/src/evidence.js` | **Edit** — use `getClient()` |
| `pinata/package.json` | **Edit** — change main to `src/index.js` |
| `backend/src/config/env.ts` | **Edit** — add PINATA_JWT, PINATA_GATEWAY |
| `backend/src/bridges/pinata.bridge.ts` | **Edit** — real impl delegating to pinata module |

---

## Verification

1. **Shippo unit tests**: `cd shippo && npx vitest run` — all pass
2. **Backend tests**: `cd backend && npx vitest run` — all existing + new bridge tests pass
3. **Backend startup**: `cd backend && npx tsx src/index.ts` — Pinata bridge initializes (or falls back to stub if no JWT)
4. **Pinata standalone**: `cd pinata && node index.js` — Express server still works with its own `.env`
5. **Existing service tests**: Mock-based tests in `backend/src/services/__tests__/` unchanged — they mock `IPinataBridge` interface, not the implementation
