import { NextResponse } from "next/server";
import { getShippingOptionsFromDatabase } from "@/lib/platform-data";

export async function GET() {
  const options = await getShippingOptionsFromDatabase();
  return NextResponse.json({ options, total: options.length });
}