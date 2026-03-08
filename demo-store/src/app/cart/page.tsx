"use client";

import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, Trash2, ShoppingCart } from "lucide-react";
import { useAccount } from "wagmi";
import { useCartStore } from "@/stores/cart-store";
import { formatUsd } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { RequireRole } from "@/components/guards/RequireRole";

function CartContent() {
  const { items, removeItem, updateQuantity, subtotalUsd } = useCartStore();
  const { isConnected } = useAccount();

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-16 text-center">
        <ShoppingCart className="h-12 w-12 text-neutral-600 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-neutral-300 mb-2">Your cart is empty</h2>
        <Link href="/">
          <Button className="mt-4">Browse Products</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-neutral-100 mb-6">Shopping Cart</h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          {items.map(({ product, quantity }) => (
            <Card key={product.id}>
              <CardContent className="p-4">
                <div className="flex gap-4">
                  <div className="relative h-20 w-20 rounded-lg overflow-hidden bg-neutral-800 shrink-0">
                    <Image src={product.image_url} alt={product.name} fill className="object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link href={`/product/${product.id}`}>
                      <p className="font-medium text-neutral-100 hover:text-violet-400 transition-colors truncate">
                        {product.name}
                      </p>
                    </Link>
                    <p className="text-sm text-neutral-400">{product.seller_name}</p>
                    <p className="text-sm font-semibold text-violet-400 mt-1">
                      {formatUsd(product.price_usd * quantity)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <button
                      onClick={() => removeItem(product.id)}
                      className="text-neutral-600 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => updateQuantity(product.id, quantity - 1)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="text-sm font-medium w-6 text-center">{quantity}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => updateQuantity(product.id, quantity + 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div>
          <Card>
            <CardContent className="p-5 space-y-4">
              <h2 className="font-semibold text-neutral-100">Order Summary</h2>
              {items.map(({ product, quantity }) => (
                <div key={product.id} className="flex justify-between text-sm text-neutral-400">
                  <span className="truncate mr-2">{product.name} ×{quantity}</span>
                  <span className="shrink-0">{formatUsd(product.price_usd * quantity)}</span>
                </div>
              ))}
              <Separator />
              <div className="flex justify-between font-bold">
                <span>Subtotal</span>
                <span>{formatUsd(subtotalUsd())}</span>
              </div>
              <p className="text-xs text-neutral-500">Shipping calculated at checkout.</p>
              <p className="text-xs text-neutral-500">Payment is escrowed via FlowState smart contract.</p>
              {isConnected ? (
                <Link href="/checkout">
                  <Button className="w-full">Proceed to Checkout</Button>
                </Link>
              ) : (
                <Button className="w-full" disabled title="Connect your wallet to checkout">
                  Connect Wallet to Checkout
                </Button>
              )}
              <Link href="/">
                <Button className="w-full" variant="outline">
                  Continue Shopping
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function CartPage() {
  return (
    <RequireRole roles={["buyer"]}>
      <CartContent />
    </RequireRole>
  );
}
