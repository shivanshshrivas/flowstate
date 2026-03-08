---
name: gas-report
description: Get a full on-chain gas cost report — total gas spent in USD, average per state transition, and breakdown by contract function
metadata: {"env": ["FLOWSTATE_API_KEY", "FLOWSTATE_API_URL"]}
---

## Usage

Call this skill when an admin wants to review blockchain gas costs, understand which contract functions are most expensive, or report on total on-chain spending.

## Parameters

- `project_id` (string, required): The Flow State project ID

## Returns

Total gas spent in USD, total on-chain transaction count, average gas cost per state transition, breakdown by transition (ESCROWED, LABEL_CREATED, SHIPPED, etc.) with count and average cost, and the most expensive transition.

## Example Triggers

- "What are our gas costs?"
- "Show me the gas report"
- "How much have we spent on-chain?"
- "Which contract calls are most expensive?"
- "On-chain cost breakdown"
