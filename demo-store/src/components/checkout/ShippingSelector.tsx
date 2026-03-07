"use client";

import { type ShippingOption } from "@/lib/flowstate/types";
import { formatUsd } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { CheckCircle, Truck } from "lucide-react";
import { MOCK_SHIPPING_OPTIONS } from "@/lib/mock-data";

interface ShippingSelectorProps {
  selected: ShippingOption | null;
  onSelect: (option: ShippingOption) => void;
}

export function ShippingSelector({ selected, onSelect }: ShippingSelectorProps) {
  return (
    <div className="space-y-2">
      {MOCK_SHIPPING_OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onSelect(option)}
          className={cn(
            "w-full flex items-center justify-between p-3 rounded-lg border transition-colors text-left",
            selected?.id === option.id
              ? "border-violet-500 bg-violet-950/30"
              : "border-neutral-700 hover:border-neutral-600 bg-neutral-800/50"
          )}
        >
          <div className="flex items-center gap-3">
            <Truck className="h-4 w-4 text-neutral-400 shrink-0" />
            <div>
              <p className="text-sm font-medium text-neutral-100">
                {option.carrier} — {option.service}
              </p>
              <p className="text-xs text-neutral-400">
                {option.estimated_days} business days
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-neutral-100">
              {formatUsd(option.price_usd)}
            </span>
            {selected?.id === option.id && (
              <CheckCircle className="h-4 w-4 text-violet-400" />
            )}
          </div>
        </button>
      ))}
    </div>
  );
}
