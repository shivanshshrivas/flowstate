---
name: list-sellers
description: List all sellers on the platform with their status, business info, and performance metrics
---

## Usage

Call this skill when an admin wants to browse sellers, check seller statuses, or review platform-wide seller performance.

## Parameters

- `project_id` (string, required): The Flow State project ID
- `status` (string, optional): Filter by seller status — one of: `pending`, `active`, `suspended`

## Returns

Total seller count and per-seller details including business name, status, email, wallet address, registration date, and performance metrics (orders, revenue, dispute rate, fulfillment speed).

## Example Triggers

- "Show me all sellers"
- "List active sellers"
- "Who are our suspended sellers?"
- "Show seller overview"
- "How many sellers do we have?"
