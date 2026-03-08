import { NextRequest, NextResponse } from "next/server";
import { getProductByIdFromDatabase } from "@/lib/platform-data";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const product = await getProductByIdFromDatabase(id);

  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  return NextResponse.json({ product });
}
