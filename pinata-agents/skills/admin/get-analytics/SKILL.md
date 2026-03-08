---
name: get-analytics
description: Get platform-wide analytics — total order volume, revenue, dispute rate, active escrows, and daily breakdown
---

## Usage

Call this skill when an admin wants a high-level view of platform health, order volume, revenue trends, or dispute rates.

## Parameters

- `project_id` (string, required): The Flow State project ID
- `period` (string, optional): Time period — one of: `today`, `last_7_days`, `last_30_days`, `all_time`

## Returns

Total orders, total volume in USD, active escrows, dispute rate percentage, open dispute count, average dispute resolution time, daily order breakdown, and platform health status (Healthy/Monitor/Attention Required).

## Example Triggers

- "How is the platform doing?"
- "Show me platform stats"
- "What's our total volume this week?"
- "What's the dispute rate?"
- "Platform analytics"
