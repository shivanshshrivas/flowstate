"use client";

import Image from "next/image";
import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { type Product } from "@/lib/flowstate/types";
import { formatUsd } from "@/lib/utils";
import { useCartStore } from "@/stores/cart-store";
import { useUserStore } from "@/stores/user-store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const addItem = useCartStore((s) => s.addItem);
  const role = useUserStore((s) => s.user?.role);
  const supabaseConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const showAddButton = !supabaseConfigured || role !== "seller";

  return (
    <Card className="group overflow-hidden hover:border-neutral-700 transition-colors">
      <Link href={`/product/${product.id}`} className="block">
        <div className="relative h-48 w-full overflow-hidden bg-neutral-800">
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            className="object-cover transition-transform group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        </div>
      </Link>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <Badge variant="secondary" className="text-xs">
            {product.category}
          </Badge>
          <span className="text-xs text-neutral-500">{product.seller_name}</span>
        </div>
        <Link href={`/product/${product.id}`}>
          <h3 className="font-semibold text-neutral-100 leading-snug hover:text-violet-400 transition-colors line-clamp-2 mb-1">
            {product.name}
          </h3>
        </Link>
        <p className="text-sm text-neutral-400 line-clamp-2 mb-3">
          {product.description}
        </p>
        <div className="flex items-center justify-between gap-2">
          <span className="text-lg font-bold text-neutral-100">
            {formatUsd(product.price_usd)}
          </span>
          {showAddButton && (
            <Button
              size="sm"
              onClick={(e) => {
                e.preventDefault();
                addItem(product);
              }}
            >
              <ShoppingCart className="h-4 w-4" />
              Add
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
