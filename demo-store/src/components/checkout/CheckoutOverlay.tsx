"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  CheckCircle,
  Loader2,
  Lock,
  ExternalLink,
  ChevronRight,
} from "lucide-react";
import {
  type Product,
  type ShippingOption,
  type ShippingAddress,
  OrderState,
  type Order,
} from "@/lib/flowstate/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ShippingSelector } from "./ShippingSelector";
import { formatUsd, formatToken } from "@/lib/utils";
import { useOrderStore } from "@/stores/order-store";

type Step = "shipping-address" | "shipping-option" | "confirm" | "processing" | "success";

interface CheckoutOverlayProps {
  open: boolean;
  onClose: () => void;
  product: Product;
}

function generateOrderId() {
  return `order-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function CheckoutOverlay({ open, onClose, product }: CheckoutOverlayProps) {
  const router = useRouter();
  const { address } = useAccount();
  const addOrder = useOrderStore((s) => s.addOrder);

  const [step, setStep] = useState<Step>("shipping-address");
  const [shippingAddress, setShippingAddress] = useState<ShippingAddress>({
    name: "",
    address1: "",
    city: "",
    state: "",
    zip: "",
    country: "US",
  });
  const [shippingOption, setShippingOption] = useState<ShippingOption | null>(null);
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const subtotal = product.price_usd;
  const shipping = shippingOption?.price_usd ?? 0;
  const total = subtotal + shipping;
  // Simulate 1 USD = 1 FLUSD for demo
  const totalToken = String(BigInt(Math.round(total * 1e18)));

  function handleClose() {
    setStep("shipping-address");
    setShippingAddress({ name: "", address1: "", city: "", state: "", zip: "", country: "US" });
    setShippingOption(null);
    setCreatedOrderId(null);
    setError(null);
    onClose();
  }

  async function handleConfirmAndPay() {
    setStep("processing");
    setError(null);

    try {
      // Simulate contract call delay (replace with actual wagmi writeContract when deployed)
      await new Promise((r) => setTimeout(r, 2000));

      const orderId = generateOrderId();
      const now = new Date().toISOString();
      const mockOrder: Order = {
        id: orderId,
        buyer_wallet: address ?? "0x0000",
        seller_id: product.seller_id,
        seller_name: product.seller_name,
        items: [
          {
            product_id: product.id,
            product_name: product.name,
            quantity: 1,
            price_usd: product.price_usd,
            image_url: product.image_url,
          },
        ],
        state: OrderState.ESCROWED,
        total_usd: total,
        total_token: totalToken,
        shipping_option: shippingOption!,
        shipping_address: shippingAddress,
        escrow: {
          escrowId: `escrow-${orderId}`,
          contractAddress: process.env.NEXT_PUBLIC_ESCROW_STATE_MACHINE_ADDRESS ?? "0x0",
          tokenAddress: process.env.NEXT_PUBLIC_MOCK_RLUSD_ADDRESS ?? "0x0",
          totalAmount: totalToken,
          remainingAmount: totalToken,
          txHash: `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("")}`,
          blockNumber: 12345678,
          createdAt: now,
        },
        payout_schedule: [
          { state: OrderState.LABEL_CREATED, percentageBps: 1500, label: "Label Printed (15%)" },
          { state: OrderState.SHIPPED, percentageBps: 1500, label: "Shipped (15%)" },
          { state: OrderState.IN_TRANSIT, percentageBps: 2000, label: "In Transit (20%)" },
          { state: OrderState.DELIVERED, percentageBps: 3500, label: "Delivered (35%)" },
          { state: OrderState.FINALIZED, percentageBps: 1500, label: "Finalized (15%)" },
        ],
        created_at: now,
        updated_at: now,
        state_history: [
          {
            from: OrderState.INITIATED,
            to: OrderState.ESCROWED,
            timestamp: now,
            txHash: `0x${Math.random().toString(16).slice(2)}`,
            triggeredBy: "buyer",
          },
        ],
      };

      addOrder(mockOrder);
      setCreatedOrderId(orderId);
      setStep("success");
    } catch {
      setError("Transaction failed. Please try again.");
      setStep("confirm");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-violet-400" />
            {step === "success" ? "Order Confirmed!" : "Secure Checkout"}
          </DialogTitle>
        </DialogHeader>

        {/* Product summary */}
        {step !== "success" && (
          <div className="flex gap-3 p-3 bg-neutral-800 rounded-lg">
            <div className="relative h-16 w-16 rounded-md overflow-hidden shrink-0">
              <Image src={product.image_url} alt={product.name} fill className="object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-neutral-100 truncate">{product.name}</p>
              <p className="text-xs text-neutral-400">{product.seller_name}</p>
              <p className="text-sm font-bold text-neutral-100 mt-1">{formatUsd(product.price_usd)}</p>
            </div>
          </div>
        )}

        {/* Step: Shipping Address */}
        {step === "shipping-address" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Full Name</Label>
                <Input
                  className="mt-1"
                  placeholder="Jane Smith"
                  value={shippingAddress.name}
                  onChange={(e) => setShippingAddress((s) => ({ ...s, name: e.target.value }))}
                />
              </div>
              <div className="col-span-2">
                <Label>Address</Label>
                <Input
                  className="mt-1"
                  placeholder="123 Main St"
                  value={shippingAddress.address1}
                  onChange={(e) => setShippingAddress((s) => ({ ...s, address1: e.target.value }))}
                />
              </div>
              <div>
                <Label>City</Label>
                <Input
                  className="mt-1"
                  placeholder="New York"
                  value={shippingAddress.city}
                  onChange={(e) => setShippingAddress((s) => ({ ...s, city: e.target.value }))}
                />
              </div>
              <div>
                <Label>State</Label>
                <Input
                  className="mt-1"
                  placeholder="NY"
                  value={shippingAddress.state}
                  onChange={(e) => setShippingAddress((s) => ({ ...s, state: e.target.value }))}
                />
              </div>
              <div>
                <Label>ZIP</Label>
                <Input
                  className="mt-1"
                  placeholder="10001"
                  value={shippingAddress.zip}
                  onChange={(e) => setShippingAddress((s) => ({ ...s, zip: e.target.value }))}
                />
              </div>
            </div>
            <Button
              className="w-full"
              disabled={!shippingAddress.name || !shippingAddress.address1 || !shippingAddress.city}
              onClick={() => setStep("shipping-option")}
            >
              Continue <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Step: Shipping Option */}
        {step === "shipping-option" && (
          <div className="space-y-4">
            <ShippingSelector selected={shippingOption} onSelect={setShippingOption} />
            <Button
              className="w-full"
              disabled={!shippingOption}
              onClick={() => setStep("confirm")}
            >
              Continue <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Step: Confirm & Pay */}
        {step === "confirm" && (
          <div className="space-y-4">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-neutral-300">
                <span>Subtotal</span>
                <span>{formatUsd(subtotal)}</span>
              </div>
              <div className="flex justify-between text-neutral-300">
                <span>Shipping ({shippingOption?.carrier} {shippingOption?.service})</span>
                <span>{formatUsd(shipping)}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-bold text-neutral-100">
                <span>Total</span>
                <span>{formatUsd(total)}</span>
              </div>
              <div className="flex justify-between text-neutral-500">
                <span>In FLUSD</span>
                <span>{formatToken(totalToken)}</span>
              </div>
            </div>

            <div className="rounded-lg border border-violet-800 bg-violet-950/20 p-3 text-xs text-violet-300 space-y-1">
              <p className="font-semibold">Protected by FlowState Escrow</p>
              <p>Your payment is held in a smart contract and released incrementally as your order progresses.</p>
            </div>

            {error && (
              <p className="text-sm text-red-400">{error}</p>
            )}

            <Button className="w-full" size="lg" onClick={handleConfirmAndPay}>
              <Lock className="h-4 w-4" />
              Approve & Pay {formatUsd(total)}
            </Button>
          </div>
        )}

        {/* Step: Processing */}
        {step === "processing" && (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="h-12 w-12 text-violet-500 animate-spin" />
            <div className="text-center">
              <p className="font-semibold text-neutral-100">Processing transaction…</p>
              <p className="text-sm text-neutral-400 mt-1">
                Approving MockRLUSD and depositing into escrow
              </p>
            </div>
          </div>
        )}

        {/* Step: Success */}
        {step === "success" && createdOrderId && (
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-600/20 border border-emerald-600">
              <CheckCircle className="h-8 w-8 text-emerald-400" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-neutral-100">Order placed successfully!</p>
              <p className="text-sm text-neutral-400 mt-1">
                {formatUsd(total)} has been escrowed. Funds release as your order progresses.
              </p>
            </div>
            <div className="w-full text-xs bg-neutral-800 rounded-lg p-3 space-y-1">
              <div className="flex justify-between">
                <span className="text-neutral-400">Order ID</span>
                <span className="text-neutral-200 font-mono">{createdOrderId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Status</span>
                <span className="text-emerald-400">Escrowed</span>
              </div>
            </div>
            <div className="flex gap-2 w-full">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  handleClose();
                  router.push(`/orders/${createdOrderId}`);
                }}
              >
                <ExternalLink className="h-4 w-4" />
                View Order
              </Button>
              <Button
                className="flex-1"
                onClick={handleClose}
              >
                Continue Shopping
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
