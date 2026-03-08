---
name: webhook-logs
description: View recent webhook delivery logs filtered by status — shows source, event type, HTTP status, and payload summary
metadata: {"env": ["FLOWSTATE_API_KEY", "FLOWSTATE_API_URL"]}
---

## Usage

Call this skill when an admin wants to review webhook delivery history, diagnose failed webhooks, or check recent event processing.

## Parameters

- `status` (string, optional): Filter by delivery status — one of: `received`, `processed`, `failed`
- `limit` (number, optional): Max number of events to return (default 20, max 50)

## Returns

Stats (total shown, processed/failed/received counts) and per-event details including event type, source, order ID, HTTP status code, timestamp, and payload summary.

## Example Triggers

- "Show me webhook logs"
- "Any failed webhooks?"
- "What webhooks have been processed today?"
- "Check webhook status"
- "Show me the last 50 webhook events"
