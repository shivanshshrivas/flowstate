---
name: respond-dispute
description: Respond to an open buyer dispute — accept to issue a full refund, or contest with evidence for admin review
metadata: {"env": ["FLOWSTATE_API_KEY", "FLOWSTATE_API_URL"]}
---

## Usage

Call this skill when a seller wants to respond to a dispute filed against one of their orders. Collect the dispute ID and the seller's chosen action before calling. If contesting, also collect their evidence or explanation.

## Parameters

- `dispute_id` (string, required): The dispute ID to respond to
- `action` (string, required): Either `accept` (agree to refund) or `contest` (dispute with evidence)
- `evidence` (string, optional): Seller's evidence or explanation — required when action is `contest`

## Returns

Updated dispute status, resolution type (refund_buyer or pending_review), and outcome message.

## Example Triggers

- "I want to respond to dispute disp-001"
- "I accept the dispute"
- "I want to contest this dispute"
- "The buyer is wrong, here's my evidence"
- "Refund the buyer for dispute disp-002"
