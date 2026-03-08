import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
  getSellerByUserIdFromDatabase,
  getSellersFromDatabase,
  supabasePlatformEnabled,
} from "@/lib/platform-data";

function makeSellerId(businessName: string) {
  const slug = businessName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);

  return `seller-${slug || "new"}-${Date.now().toString().slice(-6)}`;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mine = searchParams.get("mine") === "true";

  if (mine) {
    if (!supabasePlatformEnabled()) {
      const sellers = await getSellersFromDatabase();
      return NextResponse.json({ seller: sellers[0] ?? null });
    }

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const seller = await getSellerByUserIdFromDatabase(user.id);
    return NextResponse.json({ seller });
  }

  const sellers = await getSellersFromDatabase();
  return NextResponse.json({ sellers, total: sellers.length });
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  const required = ["business_name", "email", "wallet_address", "address"];
  for (const field of required) {
    if (!body[field]) {
      return NextResponse.json(
        { error: `Missing required field: ${field}` },
        { status: 400 }
      );
    }
  }

  const { immediate_bps = 0, milestone_bps = 0, holdback_bps = 0 } =
    body.payout_config ?? {};
  if (immediate_bps + milestone_bps + holdback_bps !== 10000) {
    return NextResponse.json(
      { error: "payout_config basis points must sum to 10000" },
      { status: 400 }
    );
  }

  if (!supabasePlatformEnabled()) {
    const seller = {
      id: makeSellerId(body.business_name),
      ...body,
      status: "pending",
      created_at: new Date().toISOString(),
    };

    return NextResponse.json({ seller }, { status: 201 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const sellerId = makeSellerId(body.business_name);
  const { error: insertError } = await supabase.from("sellers").insert({
    id: sellerId,
    user_id: user.id,
    business_name: body.business_name,
    wallet_address: body.wallet_address,
    email: body.email,
    address: body.address,
    payout_config: body.payout_config,
    status: "pending",
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 400 });
  }

  await supabase
    .from("users")
    .update({ seller_id: sellerId, role: "seller" })
    .eq("id", user.id);

  await supabase.auth.updateUser({
    data: { role: "seller", seller_id: sellerId },
  });

  const seller = await getSellerByUserIdFromDatabase(user.id);
  if (!seller) {
    return NextResponse.json(
      { error: "Seller created but could not be loaded" },
      { status: 500 }
    );
  }

  return NextResponse.json({ seller }, { status: 201 });
}
