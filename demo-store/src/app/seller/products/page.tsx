"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, PlusCircle, Package } from "lucide-react";
import { type Seller } from "@shivanshshrivas/flowstate/types";
import { type Product } from "@/types/product";
import { formatUsd } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RequireRole } from "@/components/guards/RequireRole";
import { useUserStore } from "@/stores/user-store";

const DEFAULT_SELLER_ID = "seller-001";

function SellerProductsContent() {
  const { user } = useUserStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [sellerId, setSellerId] = useState<string>(user?.seller_id ?? DEFAULT_SELLER_ID);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadSellerProfile() {
      try {
        const response = await fetch("/api/sellers?mine=true", { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as { seller?: Seller | null };
        if (!cancelled && payload.seller?.id) {
          setSellerId(payload.seller.id);
        }
      } catch {
        if (!cancelled && user?.seller_id) {
          setSellerId(user.seller_id);
        }
      }
    }

    loadSellerProfile();
    return () => {
      cancelled = true;
    };
  }, [user?.seller_id]);

  useEffect(() => {
    let cancelled = false;

    async function loadProducts() {
      if (!sellerId) return;
      setLoadingProducts(true);

      try {
        const response = await fetch(
          `/api/products?seller_id=${encodeURIComponent(sellerId)}`,
          { cache: "no-store" }
        );
        if (!response.ok) return;
        const payload = (await response.json()) as { products?: Product[] };
        if (!cancelled) {
          setProducts(payload.products ?? []);
        }
      } finally {
        if (!cancelled) {
          setLoadingProducts(false);
        }
      }
    }

    loadProducts();
    return () => {
      cancelled = true;
    };
  }, [sellerId]);

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/seller">
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ChevronLeft className="h-4 w-4" />
            Dashboard
          </Button>
        </Link>
        <h1 className="text-xl font-bold text-neutral-100 flex-1">My Products</h1>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <PlusCircle className="h-4 w-4" />
          Add Product
        </Button>
      </div>

      {showForm && (
        <Card className="mb-6 border-violet-800/50">
          <CardHeader>
            <CardTitle className="text-base">New Product</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Product Name</Label>
              <Input className="mt-1" placeholder="Premium Widget Pro" />
            </div>
            <div className="col-span-2">
              <Label>Description</Label>
              <Input className="mt-1" placeholder="A detailed description..." />
            </div>
            <div>
              <Label>Price (USD)</Label>
              <Input className="mt-1" type="number" placeholder="99.99" />
            </div>
            <div>
              <Label>Category</Label>
              <Input className="mt-1" placeholder="Electronics" />
            </div>
            <div>
              <Label>Weight (oz)</Label>
              <Input className="mt-1" type="number" placeholder="8" />
            </div>
            <div>
              <Label>Stock</Label>
              <Input className="mt-1" type="number" placeholder="10" />
            </div>
            <div className="col-span-2 flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button>Save Product</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {loadingProducts && products.length === 0 && (
          <Card>
            <CardContent className="p-6 text-sm text-neutral-500">
              Loading products...
            </CardContent>
          </Card>
        )}

        {products.map((product) => (
          <Card key={product.id}>
            <CardContent className="p-4">
              <div className="flex gap-4">
                <div className="relative h-20 w-20 rounded-lg overflow-hidden bg-neutral-800 shrink-0">
                  <Image src={product.image_url} alt={product.name} fill className="object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-neutral-100 truncate">{product.name}</p>
                    <Badge variant="secondary">{product.category}</Badge>
                  </div>
                  <p className="text-sm text-neutral-400 line-clamp-1 mt-0.5">
                    {product.description}
                  </p>
                  <div className="flex items-center gap-4 mt-2 text-sm">
                    <span className="font-bold text-violet-400">{formatUsd(product.price_usd)}</span>
                    <span className="text-neutral-500">{product.stock} in stock</span>
                    <span className="text-neutral-500">{product.weight_oz} oz</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button size="sm" variant="outline">
                    Edit
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {!loadingProducts && products.length === 0 && (
          <div className="text-center py-16 text-neutral-500">
            <Package className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>No products yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SellerProductsPage() {
  return (
    <RequireRole roles={["seller", "admin"]}>
      <SellerProductsContent />
    </RequireRole>
  );
}
