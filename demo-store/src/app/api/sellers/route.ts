import { NextRequest, NextResponse } from "next/server";
import { MOCK_SELLERS } from "@/lib/mock-data";

export async function GET() {
  return NextResponse.json({ sellers: MOCK_SELLERS, total: MOCK_SELLERS.length });
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  // Validate required fields
  const required = ["business_name", "email", "wallet_address", "address"];
  for (const field of required) {
    if (!body[field]) {
      return NextResponse.json(
        { error: `Missing required field: ${field}` },
        { status: 400 }
      );
    }
  }

  // Validate payout config sums to 10000
  const { immediate_bps = 0, milestone_bps = 0, holdback_bps = 0 } =
    body.payout_config ?? {};
  if (immediate_bps + milestone_bps + holdback_bps !== 10000) {
    return NextResponse.json(
      { error: "payout_config basis points must sum to 10000" },
      { status: 400 }
    );
  }

  // TODO: persist to Supabase when backend ready
  const seller = {
    id: `seller-${Date.now()}`,
    ...body,
    status: "pending",
    created_at: new Date().toISOString(),
  };

  return NextResponse.json({ seller }, { status: 201 });
}
