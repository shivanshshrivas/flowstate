import { NextRequest, NextResponse } from "next/server";
import { type OrderState } from "@shivanshshrivas/flowstate/types";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
  advanceOrderStateForCurrentUser,
  getOrderForCurrentUser,
} from "@/lib/order-data";
import { flowstateApi, isFlowStateEnabled } from "@/lib/flowstate-api";

function supabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

async function getAuthenticatedUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Proxy to FlowState backend if configured
  if (isFlowStateEnabled() && flowstateApi) {
    try {
      const result = await flowstateApi.getOrder(id);
      return NextResponse.json(result);
    } catch (err) {
      const status = err instanceof Error && err.message.includes("not found") ? 404 : 500;
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Failed to get order" },
        { status }
      );
    }
  }

  if (!supabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 500 });
  }

  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const order = await getOrderForCurrentUser(user, id);

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  return NextResponse.json({ order });
}

// Map target state to the correct backend endpoint
async function advanceViaBackend(orderId: string, targetState: OrderState, body: Record<string, unknown>) {
  if (!flowstateApi) return null;

  switch (targetState) {
    case "LABEL_CREATED":
      return flowstateApi.confirmLabelPrinted(orderId, {
        seller_wallet: (body.seller_wallet as string) ?? "",
      });
    case "FINALIZED":
      return flowstateApi.finalizeOrder(orderId);
    default:
      // States advanced by Shippo webhooks (SHIPPED, IN_TRANSIT, DELIVERED) — not directly callable
      return null;
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  if (!body.state || typeof body.state !== "string") {
    return NextResponse.json({ error: "Missing state" }, { status: 400 });
  }

  // Proxy to FlowState backend if configured
  if (isFlowStateEnabled() && flowstateApi) {
    try {
      const result = await advanceViaBackend(id, body.state as OrderState, body);
      if (result !== null) {
        return NextResponse.json({ result });
      }
      // For states driven by external webhooks, return a placeholder success
      return NextResponse.json({ message: `State ${body.state} is advanced by external events` });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Failed to advance order" },
        { status: 500 }
      );
    }
  }

  if (!supabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 500 });
  }

  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const order = await advanceOrderStateForCurrentUser(user, id, body.state as OrderState);
  if (!order) {
    return NextResponse.json(
      { error: "Unable to update order state" },
      { status: 400 }
    );
  }

  return NextResponse.json({ order });
}
