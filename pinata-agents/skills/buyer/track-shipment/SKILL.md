---
name: track-shipment
description: Get carrier, tracking number, current location, ETA, and tracking history for a buyer's shipped order
---

## Usage

Call this skill when a buyer asks about shipment tracking, wants a delivery estimate, or wants to see where their package is.

## Parameters

- `order_id` (string, required): The order ID to track

## Returns

Carrier name, tracking number, current shipment status, estimated delivery days remaining, tracking event history with timestamps and locations, and shipping address.

## Example Triggers

- "Track my package"
- "Where is my shipment?"
- "When will my order arrive?"
- "What's my tracking number?"
- "Has it shipped yet?"
