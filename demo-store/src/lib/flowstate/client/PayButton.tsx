"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { Zap } from "lucide-react";
import { type Product } from "../types";
import { Button } from "@/components/ui/button";
import { CheckoutOverlay } from "@/components/checkout/CheckoutOverlay";

interface PayButtonProps {
  product: Product;
  className?: string;
}

export function PayButton({ product, className }: PayButtonProps) {
  const { isConnected } = useAccount();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        size="lg"
        className={`bg-violet-600 hover:bg-violet-700 text-white font-semibold ${className ?? ""}`}
        onClick={() => setOpen(true)}
        disabled={!isConnected}
        title={!isConnected ? "Connect your wallet to checkout" : undefined}
      >
        <Zap className="h-5 w-5" />
        {isConnected ? "Pay with FlowState" : "Connect Wallet to Pay"}
      </Button>
      <CheckoutOverlay
        open={open}
        onClose={() => setOpen(false)}
        product={product}
      />
    </>
  );
}
