---
name: confirm-label
description: Confirm that a shipping label has been printed for an order — triggers state transition from ESCROWED to LABEL_CREATED and releases the immediate payout
metadata: {"env": ["FLOWSTATE_API_KEY", "FLOWSTATE_API_URL"]}
---

## Usage

Call this skill when a seller confirms they've printed a shipping label and are ready to hand the package to the carrier. The order must be in ESCROWED state. This triggers the first streaming payout.

## Parameters

- `order_id` (string, required): The order ID for which the label was printed

## Returns

Confirmation of state transition (ESCROWED → LABEL_CREATED), the USD amount released from escrow as the immediate payout, and a simulated transaction hash.

## Example Triggers

- "I printed the label for order-001"
- "Label confirmed"
- "I've shipped it"
- "Mark label as printed"
- "Confirm shipment for order-002"
