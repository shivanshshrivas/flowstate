---
name: get-receipt
description: Retrieve the invoice and receipt for a buyer's order, including line items, totals, payment method, and IPFS document URL
---

## Usage

Call this skill when a buyer asks for their receipt, invoice, proof of payment, or wants the IPFS link to their invoice document.

## Parameters

- `order_id` (string, required): The order ID to get the receipt for

## Returns

Line items with quantities and prices, subtotal, shipping cost, total in USD, payment method (escrow), escrow ID, and the IPFS gateway URL to the invoice PDF if available.

## Example Triggers

- "Show me my receipt"
- "I need my invoice for order-001"
- "Can I get proof of payment?"
- "What's the IPFS link to my invoice?"
- "Show me what I paid"
