---
name: order-status
description: Get the full current status, financials, shipping info, and state history of a specific buyer order
metadata: {"env": ["FLOWSTATE_API_KEY", "FLOWSTATE_API_URL"]}
---

## Usage

Call this skill when a buyer asks about the status of a specific order, wants to know what state their order is in, or needs details about escrow, items, or shipping.

## Parameters

- `order_id` (string, required): The order ID to look up (e.g. `order-001`)

## Returns

Order state (INITIATED/ESCROWED/LABEL_CREATED/SHIPPED/IN_TRANSIT/DELIVERED/FINALIZED/DISPUTED), item list, total amount, escrow details, payout schedule, shipping address, and full state transition history.

## Example Triggers

- "Where is my order?"
- "What's the status of order-001?"
- "Is my order shipped yet?"
- "How much is still in escrow?"
