import { NextRequest, NextResponse } from "next/server";

/**
 * Webhook receiver stub - mirrors the future FlowState backend webhook endpoint.
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

  // TODO: verify HMAC signature when shared secret is configured.
  if (process.env.FLOWSTATE_WEBHOOK_SECRET && !signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 401 });
  }

  const body = await request.json();
  const eventType = body.event ?? body.event_type;
  const data = body.data ?? body;
  const orderId = data?.order_id ?? body.order_id ?? null;

  if (!eventType) {
    return NextResponse.json({ error: "Missing event_type" }, { status: 400 });
  }

  // The backend emits { event, data, timestamp }. The older event_type shape is still accepted
  // so the demo route works against both the current backend and earlier mock payloads.
  console.log(`[Webhook] ${eventType} for order ${orderId ?? "N/A"}`, data);

  return NextResponse.json({ received: true, event_type: eventType });
}
