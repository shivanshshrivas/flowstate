import { NextRequest, NextResponse } from "next/server";

/**
 * Webhook receiver stub — mirrors the future FlowState backend webhook endpoint.
 * When the backend is live, this route forwards events to the internal API.
 *
 * Expected events:
 *   - order.state_advanced
 *   - tracking.shipped
 *   - tracking.in_transit
 *   - tracking.delivered
 *   - dispute.created
 *   - dispute.resolved
 *   - payout.released
 */
export async function POST(request: NextRequest) {
  const signature = request.headers.get("x-flowstate-signature");

  // TODO: verify HMAC signature when shared secret is configured
  if (process.env.FLOWSTATE_WEBHOOK_SECRET && !signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 401 });
  }

  const body = await request.json();
  const { event_type, order_id, data } = body;

  if (!event_type) {
    return NextResponse.json({ error: "Missing event_type" }, { status: 400 });
  }

  // TODO: process events — update DB, trigger UI refresh via revalidatePath, etc.
  console.log(`[Webhook] ${event_type} for order ${order_id ?? "N/A"}`, data);

  return NextResponse.json({ received: true, event_type });
}
