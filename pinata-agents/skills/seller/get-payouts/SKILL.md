---
name: get-payouts
description: Get a seller's complete payout history including amounts, trigger states, transaction hashes, and pending balance
metadata: {"env": ["FLOWSTATE_API_KEY", "FLOWSTATE_API_URL"]}
---

## Usage

Call this skill when a seller wants to see their earnings, payout history, or pending balance. Each payout entry shows the amount released, which state transition triggered it, and the on-chain transaction hash.

## Parameters

- `seller_id` (string, required): The seller's ID

## Returns

Total paid out in USD, pending payout balance, payout count, and a list of payout records with order ID, trigger state, amount, transaction hash, and timestamp.

## Example Triggers

- "Show me my payouts"
- "How much have I been paid?"
- "What's my pending balance?"
- "Show earnings history"
- "What's my payout for order-001?"
