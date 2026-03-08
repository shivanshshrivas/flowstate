import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createOrderForCurrentUser, listOrdersForCurrentUser } from "@/lib/order-data";
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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const buyer_wallet = searchParams.get("buyer_wallet") ?? undefined;

  // Proxy to FlowState backend if configured
  if (isFlowStateEnabled() && flowstateApi) {
    try {
      const result = await flowstateApi.listOrders({ buyer_wallet });
      return NextResponse.json(result);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Failed to list orders" },
        { status: 500 }
      );
    }
  }

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
  const body = await request.json();

  // Proxy to FlowState backend if configured
  if (isFlowStateEnabled() && flowstateApi) {
    try {
      // Translate demo-store payload → backend payload
      const backendPayload = {
        seller_id: body.seller_id,
        buyer_wallet: body.buyer_wallet ?? "",
        seller_wallet: body.seller_wallet ?? "",
        address_from: body.address_from ?? {
          name: "Seller",
          street1: "123 Main St",
          city: "San Francisco",
          state: "CA",
          zip: "94105",
          country: "US",
        },
        address_to: body.shipping_address
          ? {
              name: body.shipping_address.name,
              street1: body.shipping_address.address1,
              street2: body.shipping_address.address2,
              city: body.shipping_address.city,
              state: body.shipping_address.state,
              zip: body.shipping_address.zip,
              country: body.shipping_address.country ?? "US",
            }
          : body.address_to,
        parcel: body.parcel ?? {
          length: 10,
          width: 8,
          height: 4,
          distanceUnit: "in",
          weight: 16,
          massUnit: "oz",
        },
        items: (body.items ?? []).map((item: {
          product_id?: string;
          product_name?: string;
          name?: string;
          quantity: number;
          price_usd?: number;
          unitPriceUsd?: number;
          weightOz?: number;
        }) => ({
          externalItemId: item.product_id,
          name: item.product_name ?? item.name ?? "Item",
          quantity: item.quantity,
          unitPriceUsd: item.price_usd ?? item.unitPriceUsd ?? 0,
          weightOz: item.weightOz ?? 8,
        })),
      };

      const result = await flowstateApi.createOrder(backendPayload);
      return NextResponse.json({ order: result }, { status: 201 });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Failed to create order" },
        { status: 500 }
      );
    }
  }

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
