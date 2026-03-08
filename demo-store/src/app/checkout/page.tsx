"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import {
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  ShoppingCart,
} from "lucide-react";
import { FlowStateCheckoutButton } from "@flowstate/gateway";
import { RequireRole } from "@/components/guards/RequireRole";
import { CheckoutSteps, type CheckoutStep } from "@/components/checkout/CheckoutSteps";
import { ShippingSelector } from "@/components/checkout/ShippingSelector";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { formatToken, formatUsd } from "@/lib/utils";
import { type CartItem, useCartStore } from "@/stores/cart-store";
import {
  type Order,
  type ShippingAddress,
  type ShippingOption,
} from "@/lib/flowstate/types";

interface SellerGroup {
  sellerId: string;
  sellerName: string;
  items: CartItem[];
  subtotal: number;
}

const EMPTY_ADDRESS: ShippingAddress = {
  name: "",
  address1: "",
  city: "",
  state: "",
  zip: "",
  country: "US",
};

function usdToToken(usd: number) {
  return String(BigInt(Math.round(usd * 1e18)));
}

function splitShippingBySeller(groups: SellerGroup[], shippingUsd: number): number[] {
  if (groups.length === 0 || shippingUsd <= 0) {
    return groups.map(() => 0);
  }

  const totalSubtotal = groups.reduce((sum, group) => sum + group.subtotal, 0);
  if (totalSubtotal <= 0) {
    return groups.map((_, index) => (index === 0 ? shippingUsd : 0));
  }

  const shippingCents = Math.round(shippingUsd * 100);
  const rawCents = groups.map((group) => (group.subtotal / totalSubtotal) * shippingCents);
  const baseCents = rawCents.map((value) => Math.floor(value));

  let remaining = shippingCents - baseCents.reduce((sum, value) => sum + value, 0);
  const byFraction = rawCents
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction);

  for (let i = 0; i < remaining; i += 1) {
    baseCents[byFraction[i % byFraction.length].index] += 1;
  }

  return baseCents.map((cents) => cents / 100);
}

function CheckoutContent() {
  const router = useRouter();
  const { address, isConnected } = useAccount();

  const {
    items,
    shippingAddress: savedShippingAddress,
    shippingOption: savedShippingOption,
    setShippingAddress: saveShippingAddress,
    setShippingOption: saveShippingOption,
    clearCart,
  } = useCartStore();

  const [step, setStep] = useState<CheckoutStep>("shipping-address");
  const [shippingAddress, setShippingAddress] = useState<ShippingAddress>(
    savedShippingAddress ?? EMPTY_ADDRESS
  );
  const [shippingOption, setShippingOption] = useState<ShippingOption | null>(
    savedShippingOption
  );
  const [createdOrders, setCreatedOrders] = useState<Order[]>([]);
  const [error, setError] = useState<string | null>(null);

  const sellerGroups = useMemo<SellerGroup[]>(() => {
    const groups = new Map<string, SellerGroup>();

    for (const item of items) {
      const sellerId = item.product.seller_id;
      const existing = groups.get(sellerId);
      if (existing) {
        existing.items.push(item);
        existing.subtotal += item.product.price_usd * item.quantity;
      } else {
        groups.set(sellerId, {
          sellerId,
          sellerName: item.product.seller_name ?? "Unknown Seller",
          items: [item],
          subtotal: item.product.price_usd * item.quantity,
        });
      }
    }

    return Array.from(groups.values());
  }, [items]);

  const subtotal = useMemo(
    () => sellerGroups.reduce((sum, group) => sum + group.subtotal, 0),
    [sellerGroups]
  );
  const shipping = shippingOption?.price_usd ?? 0;
  const total = subtotal + shipping;
  const totalToken = usdToToken(total);

  const addressComplete =
    shippingAddress.name.trim() &&
    shippingAddress.address1.trim() &&
    shippingAddress.city.trim() &&
    shippingAddress.state.trim() &&
    shippingAddress.zip.trim() &&
    shippingAddress.country.trim();

  useEffect(() => {
    if (items.length === 0 && step !== "success") {
      router.replace("/cart");
    }
  }, [items.length, step, router]);

  function onAddressContinue() {
    if (!addressComplete) return;
    saveShippingAddress(shippingAddress);
    setStep("shipping-option");
  }

  function onShippingContinue() {
    if (!shippingOption) return;
    saveShippingOption(shippingOption);
    setStep("review");
  }

  async function handleConfirmAndPay() {
    if (!shippingOption || !isConnected) return;

    setError(null);
    setStep("processing");

    try {
      const shippingShares = splitShippingBySeller(sellerGroups, shippingOption.price_usd);
      const newOrders: Order[] = [];

      for (let index = 0; index < sellerGroups.length; index += 1) {
        const group = sellerGroups[index];
        const shippingShare = shippingShares[index] ?? 0;

        await new Promise((resolve) => setTimeout(resolve, 2000));

        const orderTotal = group.subtotal + shippingShare;
        const orderToken = usdToToken(orderTotal);
        const response = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            buyer_wallet: address ?? "0x0000",
            seller_id: group.sellerId,
            seller_name: group.sellerName,
            items: group.items.map(({ product, quantity }) => ({
              product_id: product.id,
              product_name: product.name,
              quantity,
              price_usd: product.price_usd,
              image_url: product.image_url,
            })),
            total_usd: orderTotal,
            total_token: orderToken,
            shipping_option: { ...shippingOption, price_usd: shippingShare },
            shipping_address: shippingAddress,
          }),
        });

        if (!response.ok) {
          throw new Error("Order creation failed");
        }

        const payload = (await response.json()) as { order?: Order };
        if (!payload.order) {
          throw new Error("Order creation failed");
        }

        newOrders.push(payload.order);
      }

      setCreatedOrders(newOrders);
      clearCart();
      setStep("success");
    } catch {
      setError("Checkout failed. Please try again.");
      setStep("review");
    }
  }

  if (items.length === 0 && step !== "success") {
    return (
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16 text-center">
        <ShoppingCart className="mx-auto mb-4 h-12 w-12 text-neutral-600" />
        <p className="text-neutral-400">Your cart is empty. Redirecting to cart...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-100">Checkout</h1>
          <p className="text-sm text-neutral-400">
            Complete your FlowState escrow checkout for all cart items.
          </p>
        </div>
        <Link href="/cart">
          <Button variant="ghost" size="sm">
            <ChevronLeft className="h-4 w-4" />
            Back to Cart
          </Button>
        </Link>
      </div>

      <Card>
        <CardContent className="pt-6">
          <CheckoutSteps step={step} />
        </CardContent>
      </Card>

      {step === "shipping-address" && (
        <Card>
          <CardHeader>
            <CardTitle>Shipping Address</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={shippingAddress.name}
                  onChange={(e) =>
                    setShippingAddress((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="Jane Smith"
                  className="mt-1"
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="address1">Address</Label>
                <Input
                  id="address1"
                  value={shippingAddress.address1}
                  onChange={(e) =>
                    setShippingAddress((prev) => ({ ...prev, address1: e.target.value }))
                  }
                  placeholder="123 Main St"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={shippingAddress.city}
                  onChange={(e) =>
                    setShippingAddress((prev) => ({ ...prev, city: e.target.value }))
                  }
                  placeholder="Austin"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  value={shippingAddress.state}
                  onChange={(e) =>
                    setShippingAddress((prev) => ({ ...prev, state: e.target.value }))
                  }
                  placeholder="TX"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="zip">ZIP Code</Label>
                <Input
                  id="zip"
                  value={shippingAddress.zip}
                  onChange={(e) =>
                    setShippingAddress((prev) => ({ ...prev, zip: e.target.value }))
                  }
                  placeholder="73301"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  value={shippingAddress.country}
                  onChange={(e) =>
                    setShippingAddress((prev) => ({ ...prev, country: e.target.value }))
                  }
                  placeholder="US"
                  className="mt-1"
                />
              </div>
            </div>
            <Button className="w-full sm:w-auto" disabled={!addressComplete} onClick={onAddressContinue}>
              Continue
              <ChevronRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {step === "shipping-option" && (
        <Card>
          <CardHeader>
            <CardTitle>Select Shipping Method</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ShippingSelector selected={shippingOption} onSelect={setShippingOption} />
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button variant="outline" onClick={() => setStep("shipping-address")}>
                Back
              </Button>
              <Button disabled={!shippingOption} onClick={onShippingContinue}>
                Continue
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "review" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            {sellerGroups.map((group) => (
              <Card key={group.sellerId}>
                <CardHeader>
                  <CardTitle className="text-base">
                    {group.sellerName}
                    <span className="ml-2 text-xs font-normal text-neutral-400">
                      Order subtotal {formatUsd(group.subtotal)}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {group.items.map(({ product, quantity }) => (
                    <div key={product.id} className="flex gap-3">
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-neutral-800">
                        <Image src={product.image_url} alt={product.name} fill className="object-cover" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-neutral-100">{product.name}</p>
                        <p className="text-xs text-neutral-400">Qty {quantity}</p>
                      </div>
                      <p className="text-sm font-semibold text-neutral-100">
                        {formatUsd(product.price_usd * quantity)}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>

          <div>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Payment Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm text-neutral-400">
                  <span>Subtotal</span>
                  <span>{formatUsd(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm text-neutral-400">
                  <span>
                    Shipping ({shippingOption?.carrier} {shippingOption?.service})
                  </span>
                  <span>{formatUsd(shipping)}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-semibold text-neutral-100">
                  <span>Total</span>
                  <span>{formatUsd(total)}</span>
                </div>
                <div className="flex justify-between text-sm text-neutral-500">
                  <span>In FLUSD</span>
                  <span>{formatToken(totalToken)}</span>
                </div>

                <div className="rounded-lg border border-violet-800 bg-violet-950/20 p-3 text-xs text-violet-300">
                  <p className="font-semibold">Protected by FlowState Escrow</p>
                  <p>
                    Your payment is held in a smart contract and released incrementally as
                    each order progresses.
                  </p>
                </div>

                {error && <p className="text-sm text-red-400">{error}</p>}

                <div className="flex flex-col gap-2 pt-2">
                  <Button variant="outline" onClick={() => setStep("shipping-option")}>
                    Back
                  </Button>
                  <Button variant="outline" disabled>
                    Pay with Credit Card
                  </Button>
                  <Button variant="outline" disabled>
                    Pay with Credit Card
                  </Button>
                  <Button variant="outline" disabled>
                    Pay with PayPal
                  </Button>
                  <FlowStateCheckoutButton
                    onClick={handleConfirmAndPay}
                    disabled={!shippingOption || !isConnected || sellerGroups.length === 0}
                    isConnected={isConnected}
                    amountLabel={formatUsd(total)}
                    title={!isConnected ? "Connect your wallet to checkout" : undefined}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {step === "processing" && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <Loader2 className="h-12 w-12 animate-spin text-violet-500" />
            <div className="space-y-1 text-center">
              <p className="font-semibold text-neutral-100">Processing transaction...</p>
              <p className="text-sm text-neutral-400">
                Creating seller orders and depositing funds into escrow.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "success" && (
        <Card>
          <CardContent className="flex flex-col items-center gap-5 py-10">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-emerald-600 bg-emerald-600/20">
              <CheckCircle className="h-8 w-8 text-emerald-400" />
            </div>
            <div className="space-y-1 text-center">
              <p className="text-xl font-semibold text-neutral-100">Orders placed successfully!</p>
              <p className="text-sm text-neutral-400">
                {createdOrders.length} seller order{createdOrders.length === 1 ? "" : "s"} created.
              </p>
            </div>

            <div className="w-full max-w-xl space-y-2">
              {createdOrders.map((order) => (
                <Link
                  key={order.id}
                  href={`/orders/${order.id}`}
                  className="flex items-center justify-between rounded-lg border border-neutral-700 bg-neutral-900/40 px-4 py-3 text-sm hover:border-violet-600 transition-colors"
                >
                  <span className="font-mono text-neutral-200">{order.id}</span>
                  <span className="text-neutral-400">
                    {order.seller_name} {formatUsd(order.total_usd)}
                  </span>
                </Link>
              ))}
            </div>

            <div className="flex w-full max-w-xl flex-col gap-2 sm:flex-row">
              <Link href="/orders" className="w-full">
                <Button className="w-full" variant="outline">
                  View Orders
                </Button>
              </Link>
              <Link href="/" className="w-full">
                <Button className="w-full">Continue Shopping</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <RequireRole roles={["buyer"]}>
      <CheckoutContent />
    </RequireRole>
  );
}
