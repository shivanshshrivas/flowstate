---
name: list-my-orders
description: List all orders for the current buyer, optionally filtered by status
metadata: {"env": ["FLOWSTATE_API_KEY", "FLOWSTATE_API_URL"]}
---

## Usage

Call this skill when a buyer wants to see all their orders or filter orders by a specific state. The buyer wallet address is passed as the `buyer_wallet` parameter.

## Parameters

- `buyer_wallet` (string, required): The buyer's Ethereum wallet address
- `status` (string, optional): Filter by order state — one of: `INITIATED`, `ESCROWED`, `LABEL_CREATED`, `SHIPPED`, `IN_TRANSIT`, `DELIVERED`, `FINALIZED`, `DISPUTED`

## Returns

Total count of matching orders and a summary list with order ID, state, seller, items summary, total amount, tracking number, and timestamps.

## Example Triggers

- "Show me all my orders"
- "What orders do I have?"
- "Show me my disputed orders"
- "List my delivered orders"
- "Order history"
