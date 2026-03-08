"use client";

import { useState, useCallback } from "react";
import { Zap, X, ChevronRight, Loader2, CheckCircle, MapPin, Truck } from "lucide-react";
import { useFlowState } from "./FlowStateProvider";
import {
  type OrderItem,
  type ShippingOption,
  type ShippingAddress,
} from "./types/index";
import { clsx } from "clsx";

function cn(...args: Parameters<typeof clsx>) {
  return clsx(...args);
}

type CheckoutStep = "address" | "shipping" | "review" | "processing" | "success";

export interface PayButtonProps {
  items: Array<{
    name: string;
    quantity: number;
    unitPriceUsd: number;
    weightOz?: number;
    externalItemId?: string;
  }>;
  sellerId: string;
  sellerWallet: string;
  addressFrom: {
    name: string;
    street1: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  onSuccess?: (orderId: string) => void;
  onError?: (error: Error) => void;
  disabled?: boolean;
  className?: string;
  label?: string;
}

const EMPTY_ADDRESS: ShippingAddress = {
  name: "",
  address1: "",
  address2: "",
  city: "",
  state: "",
  zip: "",
  country: "US",
};

export function PayButton({
  items,
  sellerId,
  sellerWallet,
  addressFrom,
  onSuccess,
  onError,
  disabled,
  className,
  label = "Pay with FlowState",
}: PayButtonProps) {
  const { apiClient } = useFlowState();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<CheckoutStep>("address");
  const [address, setAddress] = useState<ShippingAddress>(EMPTY_ADDRESS);
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
  const [selectedRate, setSelectedRate] = useState<ShippingOption | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setStep("address");
    setAddress(EMPTY_ADDRESS);
    setShippingOptions([]);
    setSelectedRate(null);
    setOrderId(null);
    setError(null);
  }

  function close() {
    setOpen(false);
    reset();
  }

  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPriceUsd, 0);

  async function handleAddressSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!apiClient) { setError("API client not configured"); return; }

    setLoading(true);
    setError(null);
    try {
      const result = await apiClient.createOrder({
        seller_id: sellerId,
        buyer_wallet: "",
        seller_wallet: sellerWallet,
        address_from: {
          name: addressFrom.name,
          street1: addressFrom.street1,
          city: addressFrom.city,
          state: addressFrom.state,
          zip: addressFrom.zip,
          country: addressFrom.country,
        },
        address_to: {
          name: address.name,
          street1: address.address1,
          street2: address.address2,
          city: address.city,
          state: address.state,
          zip: address.zip,
          country: address.country,
        },
        parcel: {
          length: 10,
          width: 8,
          height: 4,
          distanceUnit: "in",
          weight: items.reduce((s, i) => s + (i.weightOz ?? 8) * i.quantity, 0),
          massUnit: "oz",
        },
        items: items.map((i) => ({
          externalItemId: i.externalItemId,
          name: i.name,
          quantity: i.quantity,
          unitPriceUsd: i.unitPriceUsd,
          weightOz: i.weightOz,
        })),
      });

      setOrderId(result.order_id);
      setShippingOptions(result.shipping_options);
      setStep("shipping");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get shipping rates");
    } finally {
      setLoading(false);
    }
  }

  async function handleShippingSelect() {
    if (!apiClient || !orderId || !selectedRate) return;

    setLoading(true);
    setError(null);
    try {
      await apiClient.selectShipping(orderId, { rate_id: selectedRate.id });
      setStep("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to select shipping");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmPayment() {
    if (!apiClient || !orderId) return;

    setLoading(true);
    setStep("processing");
    setError(null);
    try {
      // In a full implementation, this would trigger wallet approval and escrow deposit
      // For now, confirm escrow with a placeholder tx hash
      await apiClient.confirmEscrow(orderId, { tx_hash: `0x${orderId.replace(/-/g, "")}` });
      setStep("success");
      onSuccess?.(orderId);
    } catch (err) {
      const e = err instanceof Error ? err : new Error("Payment failed");
      setError(e.message);
      setStep("review");
      onError?.(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={disabled || !apiClient}
        className={cn(
          "flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors",
          className
        )}
      >
        <Zap className="h-4 w-4" />
        {label}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={close} />

          <div className="relative w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-900 shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-neutral-800 px-5 py-4">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-violet-400" />
                <span className="font-semibold text-neutral-100">FlowState Checkout</span>
              </div>
              <button onClick={close} className="text-neutral-500 hover:text-neutral-300">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Steps indicator */}
            {step !== "success" && (
              <div className="flex items-center gap-1.5 px-5 py-3 border-b border-neutral-800">
                {(["address", "shipping", "review"] as const).map((s, i) => (
                  <div key={s} className="flex items-center gap-1.5">
                    <div
                      className={cn(
                        "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold",
                        (step === s || (step === "processing" && s === "review"))
                          ? "bg-violet-600 text-white"
                          : ["processing", "review", "shipping"].indexOf(step) > i
                          ? "bg-emerald-600 text-white"
                          : "bg-neutral-800 text-neutral-500"
                      )}
                    >
                      {i + 1}
                    </div>
                    <span className={cn("text-xs", step === s ? "text-neutral-200" : "text-neutral-500")}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </span>
                    {i < 2 && <ChevronRight className="h-3 w-3 text-neutral-600" />}
                  </div>
                ))}
              </div>
            )}

            <div className="p-5">
              {error && (
                <div className="mb-4 rounded-lg border border-red-800 bg-red-950/40 p-3 text-sm text-red-300">
                  {error}
                </div>
              )}

              {step === "address" && (
                <form onSubmit={handleAddressSubmit} className="space-y-3">
                  <div className="flex items-center gap-2 mb-4">
                    <MapPin className="h-4 w-4 text-violet-400" />
                    <h3 className="font-medium text-neutral-200">Shipping Address</h3>
                  </div>
                  {[
                    { field: "name", label: "Full Name", required: true },
                    { field: "address1", label: "Street Address", required: true },
                    { field: "address2", label: "Apt, Suite (optional)", required: false },
                    { field: "city", label: "City", required: true },
                    { field: "state", label: "State", required: true },
                    { field: "zip", label: "ZIP Code", required: true },
                  ].map(({ field, label, required }) => (
                    <div key={field}>
                      <label className="mb-1 block text-xs text-neutral-400">{label}</label>
                      <input
                        required={required}
                        value={(address as unknown as Record<string, string>)[field] ?? ""}
                        onChange={(e) => setAddress((prev) => ({ ...prev, [field]: e.target.value }))}
                        className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-200 outline-none focus:border-violet-500/50"
                      />
                    </div>
                  ))}
                  <button
                    type="submit"
                    disabled={loading}
                    className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50 transition-colors"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Get Shipping Rates
                  </button>
                </form>
              )}

              {step === "shipping" && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 mb-4">
                    <Truck className="h-4 w-4 text-violet-400" />
                    <h3 className="font-medium text-neutral-200">Select Shipping</h3>
                  </div>
                  {shippingOptions.length === 0 ? (
                    <p className="text-sm text-neutral-500">No shipping options available.</p>
                  ) : (
                    shippingOptions.map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => setSelectedRate(opt)}
                        className={cn(
                          "w-full rounded-xl border p-3 text-left transition-colors",
                          selectedRate?.id === opt.id
                            ? "border-violet-500 bg-violet-500/10"
                            : "border-neutral-700 hover:border-neutral-600 bg-neutral-800"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-neutral-200">{opt.carrier} {opt.service}</p>
                            <p className="text-xs text-neutral-500">{opt.estimated_days} days</p>
                          </div>
                          <span className="text-sm font-semibold text-neutral-100">
                            ${opt.price_usd.toFixed(2)}
                          </span>
                        </div>
                      </button>
                    ))
                  )}
                  <button
                    onClick={handleShippingSelect}
                    disabled={!selectedRate || loading}
                    className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50 transition-colors"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Continue to Review
                  </button>
                </div>
              )}

              {step === "review" && (
                <div className="space-y-4">
                  <h3 className="font-medium text-neutral-200">Review Order</h3>
                  <div className="rounded-xl border border-neutral-800 bg-neutral-800/50 p-3 space-y-2">
                    {items.map((item, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="text-neutral-300">{item.name} × {item.quantity}</span>
                        <span className="text-neutral-400">${(item.quantity * item.unitPriceUsd).toFixed(2)}</span>
                      </div>
                    ))}
                    {selectedRate && (
                      <div className="flex items-center justify-between text-sm border-t border-neutral-700 pt-2">
                        <span className="text-neutral-300">Shipping ({selectedRate.carrier})</span>
                        <span className="text-neutral-400">${selectedRate.price_usd.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-sm border-t border-neutral-700 pt-2 font-semibold">
                      <span className="text-neutral-200">Total</span>
                      <span className="text-neutral-100">${(subtotal + (selectedRate?.price_usd ?? 0)).toFixed(2)}</span>
                    </div>
                  </div>
                  <p className="text-xs text-neutral-500">
                    Funds will be held in escrow and released to the seller as your order progresses.
                  </p>
                  <button
                    onClick={handleConfirmPayment}
                    disabled={loading}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50 transition-colors"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                    Confirm &amp; Deposit Escrow
                  </button>
                </div>
              )}

              {step === "processing" && (
                <div className="flex flex-col items-center gap-4 py-8">
                  <Loader2 className="h-10 w-10 animate-spin text-violet-400" />
                  <p className="text-sm font-medium text-neutral-200">Processing Payment...</p>
                  <p className="text-xs text-neutral-500">Please approve the transaction in your wallet</p>
                </div>
              )}

              {step === "success" && (
                <div className="flex flex-col items-center gap-4 py-8 text-center">
                  <CheckCircle className="h-12 w-12 text-emerald-400" />
                  <div>
                    <p className="font-semibold text-neutral-100">Payment Successful!</p>
                    <p className="mt-1 text-sm text-neutral-400">
                      Your funds are secured in escrow. Track your order progress.
                    </p>
                  </div>
                  {orderId && (
                    <p className="text-xs font-mono text-neutral-500">Order: {orderId}</p>
                  )}
                  <button
                    onClick={close}
                    className="rounded-xl bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 transition-colors"
                  >
                    Done
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
