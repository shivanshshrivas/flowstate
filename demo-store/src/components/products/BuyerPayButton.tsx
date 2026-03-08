"use client";

import { useUserStore } from "@/stores/user-store";
import { PayButton } from "@/lib/flowstate/client/PayButton";
import type { Product } from "@/lib/flowstate/types";

export function BuyerPayButton({ product, className }: { product: Product; className?: string }) {
  const role = useUserStore((s) => s.user?.role);
  const supabaseConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (supabaseConfigured && role === "seller") return null;
  return <PayButton product={product} className={className} />;
}
