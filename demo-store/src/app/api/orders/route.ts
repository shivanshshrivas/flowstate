import { NextRequest, NextResponse } from "next/server";
import { OrderState } from "@/lib/flowstate/types";

export async function POST(request: NextRequest) {
  const body = await request.json();

  const required = ["buyer_wallet", "seller_id", "items", "shipping_option", "shipping_address"];
  for (const field of required) {
    if (!body[field]) {
      return NextResponse.json(
        { error: `Missing required field: ${field}` },
        { status: 400 }
      );
    }
  }

  // TODO: verify on-chain escrow tx, persist to Supabase when backend ready
  const order = {
    id: `order-${Date.now()}`,
    ...body,
    state: OrderState.ESCROWED,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    state_history: [
      {
        from: OrderState.INITIATED,
        to: OrderState.ESCROWED,
        timestamp: new Date().toISOString(),
        triggeredBy: "buyer",
      },
    ],
    payout_schedule: [
      { state: OrderState.LABEL_CREATED, percentageBps: 1500, label: "Label Printed (15%)" },
      { state: OrderState.SHIPPED, percentageBps: 1500, label: "Shipped (15%)" },
      { state: OrderState.IN_TRANSIT, percentageBps: 2000, label: "In Transit (20%)" },
      { state: OrderState.DELIVERED, percentageBps: 3500, label: "Delivered (35%)" },
      { state: OrderState.FINALIZED, percentageBps: 1500, label: "Finalized (15%)" },
    ],
  };

  return NextResponse.json({ order }, { status: 201 });
}
