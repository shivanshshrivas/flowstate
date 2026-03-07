import { NextRequest, NextResponse } from "next/server";
import { MOCK_PRODUCTS } from "@/lib/mock-data";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const search = searchParams.get("search");
  const sellerId = searchParams.get("seller_id");

  let products = MOCK_PRODUCTS;

  if (category && category !== "All") {
    products = products.filter((p) => p.category === category);
  }
  if (search) {
    const q = search.toLowerCase();
    products = products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
    );
  }
  if (sellerId) {
    products = products.filter((p) => p.seller_id === sellerId);
  }

  return NextResponse.json({ products, total: products.length });
}
