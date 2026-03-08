---
name: list-orders
description: List a seller's orders, optionally filtered by status — flags orders that need immediate action
---

## Usage

Call this skill when a seller wants to see their orders, check what needs attention, or filter by a specific order state. ESCROWED orders need a label printed; DISPUTED orders need a response.

## Parameters

- `seller_id` (string, required): The seller's ID (e.g. `seller-001`)
- `status` (string, optional): Filter by order state — one of: `INITIATED`, `ESCROWED`, `LABEL_CREATED`, `SHIPPED`, `IN_TRANSIT`, `DELIVERED`, `FINALIZED`, `DISPUTED`

## Returns

Total order count, number needing action, and per-order details including action required, buyer wallet, items, total, tracking, and timestamps.

## Example Triggers

- "Show me my orders"
- "What orders need my attention?"
- "Show pending orders"
- "Which orders haven't shipped yet?"
- "Do I have any disputed orders?"
