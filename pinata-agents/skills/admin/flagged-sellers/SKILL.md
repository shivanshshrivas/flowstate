---
name: flagged-sellers
description: List sellers whose dispute rate exceeds a threshold — returns risk level and recommended action per seller
metadata: {"env": ["FLOWSTATE_API_KEY", "FLOWSTATE_API_URL"]}
---

## Usage

Call this skill when an admin wants to identify problematic sellers, review high-dispute-rate sellers, or decide who to monitor or suspend. Default threshold is 5%.

## Parameters

- `project_id` (string, required): The Flow State project ID
- `threshold` (number, optional): Dispute rate threshold as a decimal (e.g. `0.05` for 5%). Default is `0.05`.

## Returns

Threshold used, count of flagged sellers, and per-seller details including dispute rate, total orders, revenue, risk level (Critical/High/Elevated), and recommended action.

## Example Triggers

- "Show me problem sellers"
- "Which sellers have high dispute rates?"
- "Flag sellers above 10% disputes"
- "Who should we suspend?"
- "Show critical sellers"
