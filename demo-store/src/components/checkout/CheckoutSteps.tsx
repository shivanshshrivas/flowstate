"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type CheckoutStep =
  | "shipping-address"
  | "shipping-option"
  | "review"
  | "processing"
  | "success";

const STEP_LABELS = [
  { id: "shipping-address", label: "Address" },
  { id: "shipping-option", label: "Shipping" },
  { id: "review", label: "Review" },
  { id: "complete", label: "Complete" },
] as const;

function getActiveIndex(step: CheckoutStep): number {
  switch (step) {
    case "shipping-address":
      return 0;
    case "shipping-option":
      return 1;
    case "review":
      return 2;
    case "processing":
    case "success":
      return 3;
    default:
      return 0;
  }
}

export function CheckoutSteps({ step }: { step: CheckoutStep }) {
  const activeIndex = getActiveIndex(step);

  return (
    <ol className="grid grid-cols-4 gap-2" aria-label="Checkout progress">
      {STEP_LABELS.map((item, index) => {
        const isComplete = index < activeIndex;
        const isCurrent = index === activeIndex;

        return (
          <li key={item.id} className="flex flex-col items-center gap-2">
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold transition-colors",
                isComplete && "border-emerald-500 bg-emerald-500/20 text-emerald-300",
                isCurrent &&
                  !isComplete &&
                  "border-violet-500 bg-violet-500/20 text-violet-200",
                !isCurrent &&
                  !isComplete &&
                  "border-neutral-700 bg-neutral-800 text-neutral-500"
              )}
            >
              {isComplete ? <Check className="h-4 w-4" /> : index + 1}
            </div>
            <span
              className={cn(
                "text-center text-[11px] sm:text-xs",
                isCurrent || isComplete ? "text-neutral-200" : "text-neutral-500"
              )}
            >
              {item.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
