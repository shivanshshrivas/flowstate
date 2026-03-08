import { NextRequest, NextResponse } from "next/server";
import { FlowStateServer } from "@flowstate/gateway/server";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { supabasePlatformEnabled } from "@/lib/platform-data";

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-flowstate-signature");

  const flowstate = new FlowStateServer({
    apiKey: process.env.FLOWSTATE_API_KEY,
    webhookSecret: process.env.FLOWSTATE_WEBHOOK_SECRET,
  });

  let body: Record<string, unknown>;
  try {
    body = flowstate.verifyAndParse(rawBody, signature) as unknown as Record<string, unknown>;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Webhook verification failed";
    const status = message.includes("signature") ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }

  const { event_type, order_id, data } = body;

  if (!event_type || typeof event_type !== "string") {
    return NextResponse.json({ error: "Missing event_type" }, { status: 400 });
  }

  console.log(`[Webhook] ${event_type} for order ${order_id ?? "N/A"}`, data);

  if (supabasePlatformEnabled() && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const admin = createSupabaseAdminClient();
    const source = typeof body.source === "string" ? body.source : "flowstate";
    const status =
      body.status === "processed" || body.status === "failed" ? body.status : "received";
    const httpStatus =
      typeof body.http_status === "number" && Number.isFinite(body.http_status)
        ? body.http_status
        : null;

    const { error: insertError } = await admin.from("webhook_events").insert({
      event_type,
      source,
      order_id: typeof order_id === "string" ? order_id : null,
      payload: data ?? body,
      status,
      http_status: httpStatus,
    });

    if (insertError) {
      console.error("[Webhook] Failed to persist event", insertError.message);
    }
  }

  return NextResponse.json({ received: true, event_type });
}
