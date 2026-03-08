---
name: get-metrics
description: Get a seller's performance metrics — order counts, revenue, fulfillment speed, dispute rate, pending payouts, and reputation score
metadata: {"env": ["FLOWSTATE_API_KEY", "FLOWSTATE_API_URL"]}
---

## Usage

Call this skill when a seller wants to see how they're performing, check their dispute rate, or review their revenue and fulfillment metrics.

## Parameters

- `seller_id` (string, required): The seller's ID
- `period` (string, optional): Time period — one of: `today`, `this_week`, `this_month`, `all_time`

## Returns

Total orders, revenue, average fulfillment time in hours, dispute rate percentage, active escrows, pending payout balance, order breakdown by state, and reputation score (Excellent/Good/Fair/Needs Improvement).

## Example Triggers

- "How am I doing?"
- "What's my dispute rate?"
- "Show me my metrics"
- "How much have I earned?"
- "What's my fulfillment speed?"
- "What's my reputation score?"
