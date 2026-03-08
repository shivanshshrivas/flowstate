---
name: file-dispute
description: File a dispute against an order for a damaged, wrong, or missing item — freezes remaining escrow and notifies the seller
metadata: {"env": ["FLOWSTATE_API_KEY", "FLOWSTATE_API_URL"]}
---

## Usage

Call this skill when a buyer wants to open a dispute on an order. Collect the order ID, reason category, and a description before calling. Walk the buyer through the reason options if they haven't specified one.

## Parameters

- `order_id` (string, required): The order ID to dispute
- `reason` (string, required): One of: `item_damaged`, `item_not_received`, `wrong_item`, `not_as_described`, `other`
- `description` (string, required): Detailed description of the issue (minimum 10 characters)

## Returns

Dispute ID, frozen escrow amount in USD, seller response deadline, and next steps for the buyer.

## Example Triggers

- "I want to file a dispute"
- "My item arrived damaged"
- "I received the wrong item"
- "My package never arrived"
- "This isn't what I ordered"
