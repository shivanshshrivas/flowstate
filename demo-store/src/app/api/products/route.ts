import { NextRequest, NextResponse } from "next/server";
import { getProductsFromDatabase } from "@/lib/platform-data";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const search = searchParams.get("search");
  const sellerId = searchParams.get("seller_id");

  const products = await getProductsFromDatabase({
    category,
    search,
    sellerId,
  });

  return NextResponse.json({ products, total: products.length });
}
