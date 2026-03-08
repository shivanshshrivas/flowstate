"use client";

import { useEffect, useState } from "react";
import { type ShippingOption } from "@/lib/flowstate/types";
import { formatUsd } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { CheckCircle, Truck } from "lucide-react";

interface ShippingSelectorProps {
  selected: ShippingOption | null;
  onSelect: (option: ShippingOption) => void;
}

export function ShippingSelector({ selected, onSelect }: ShippingSelectorProps) {
  const [options, setOptions] = useState<ShippingOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadOptions() {
      try {
        const response = await fetch("/api/shipping/options", { cache: "no-store" });
        if (!response.ok) {
          if (!cancelled) setOptions([]);
          return;
        }

        const payload = (await response.json()) as { options?: ShippingOption[] };
        if (!cancelled) setOptions(payload.options ?? []);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadOptions();
    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoading) {
    return <p className="text-sm text-neutral-500">Loading shipping options...</p>;
  }

  if (options.length === 0) {
    return (
      <p className="text-sm text-neutral-500">
        No shipping options available. Check your Supabase seed data.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {options.map((option) => (
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
