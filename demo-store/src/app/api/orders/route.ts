import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createOrderForCurrentUser, listOrdersForCurrentUser } from "@/lib/order-data";

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

export async function GET() {
  if (!supabaseConfigured()) {
    return NextResponse.json({ orders: [], total: 0 });
  }

  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const orders = await listOrdersForCurrentUser(user);
  return NextResponse.json({ orders, total: orders.length });
}

export async function POST(request: NextRequest) {
  if (!supabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase is not configured" },
      { status: 500 }
    );
  }

  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const body = await request.json();

  const required = [
    "seller_id",
    "items",
    "shipping_option",
    "shipping_address",
    "total_usd",
    "total_token",
  ];
  for (const field of required) {
    if (!body[field]) {
      return NextResponse.json(
        { error: `Missing required field: ${field}` },
        { status: 400 }
      );
    }
  }

  const order = await createOrderForCurrentUser(user, body);
  if (!order) {
    return NextResponse.json({ error: "Failed to create order" }, { status: 400 });
  }

  return NextResponse.json({ order }, { status: 201 });
}