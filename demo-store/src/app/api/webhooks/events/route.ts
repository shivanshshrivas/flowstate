import { NextRequest, NextResponse } from "next/server";
import { getWebhookEventsFromDatabase } from "@/lib/platform-data";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limitParam = Number(searchParams.get("limit") ?? "20");
  const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(100, limitParam)) : 20;

  const events = await getWebhookEventsFromDatabase(limit);
  return NextResponse.json({ events, total: events.length });
}
