"use client";

import { useUserStore } from "@/stores/user-store";
import { PayButton } from "@shivanshshrivas/flowstate";
import { type Product } from "@/types/product";

export function BuyerPayButton({ product, className }: { product: Product; className?: string }) {
  const role = useUserStore((s) => s.user?.role);
  const supabaseConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (supabaseConfigured && role === "seller") return null;

  return (
    <PayButton
      items={[{
        name: product.name,
        quantity: 1,
        unitPriceUsd: product.price_usd,
        weightOz: product.weight_oz,
        externalItemId: product.id,
      }]}
      sellerId={product.seller_id}
      sellerWallet={product.seller_wallet ?? ""}
      addressFrom={{
        name: product.seller_name ?? "FlowState Seller",
        street1: "123 Warehouse St",
        city: "San Francisco",
        state: "CA",
        zip: "94105",
        country: "US",
      }}
      className={className}
    />
  );
}
