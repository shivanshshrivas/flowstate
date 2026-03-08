import { NextRequest, NextResponse } from "next/server";
import { type OrderState } from "@/lib/flowstate/types";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
  advanceOrderStateForCurrentUser,
  getOrderForCurrentUser,
} from "@/lib/order-data";

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
  if (!supabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 500 });
  }

  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { id } = await params;
  const order = await getOrderForCurrentUser(user, id);

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  return NextResponse.json({ order });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!supabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 500 });
  }

  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const body = await request.json();
  if (!body.state || typeof body.state !== "string") {
    return NextResponse.json({ error: "Missing state" }, { status: 400 });
  }

  const { id } = await params;
  const order = await advanceOrderStateForCurrentUser(user, id, body.state as OrderState);
  if (!order) {
    return NextResponse.json(
      { error: "Unable to update order state" },
      { status: 400 }
    );
  }

  return NextResponse.json({ order });
}