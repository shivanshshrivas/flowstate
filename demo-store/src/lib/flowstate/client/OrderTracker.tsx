"use client";

import { CheckCircle, Circle, AlertTriangle, ExternalLink } from "lucide-react";
import {
  type Order,
  OrderState,
  ORDER_STATE_LABELS,
  ORDER_STATE_SEQUENCE,
} from "../types";
import { formatDateTime, formatToken } from "@/lib/utils";
import { XRPL_EXPLORER_URL } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface OrderTrackerProps {
  order: Order;
}

export function OrderTracker({ order }: OrderTrackerProps) {
  const isDisputed = order.state === OrderState.DISPUTED;
  const currentIdx = ORDER_STATE_SEQUENCE.indexOf(order.state);

  return (
    <div className="space-y-6">
      {/* Disputed banner */}
      {isDisputed && (
        <div className="flex items-center gap-3 rounded-xl border border-red-800 bg-red-950/40 p-4">
          <AlertTriangle className="h-5 w-5 text-red-400 shrink-0" />
          <div>
            <p className="font-semibold text-red-300">Order Disputed</p>
            <p className="text-sm text-red-400">
              Funds are frozen. The dispute is under review.
            </p>
          </div>
        </div>
      )}

      {/* Progress timeline */}
      <div className="relative">
        {ORDER_STATE_SEQUENCE.map((state, idx) => {
          const transition = order.state_history.find((h) => h.to === state);
          const payout = order.payout_schedule.find((p) => p.state === state);
          const isPast = currentIdx > idx && !isDisputed;
          const isCurrent = currentIdx === idx && !isDisputed;
          const isFuture = currentIdx < idx || isDisputed;

          return (
            <div key={state} className="flex gap-4">
              {/* Left: icon + connector */}
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full border-2 shrink-0",
                    isPast
                      ? "border-emerald-500 bg-emerald-500"
                      : isCurrent
                      ? "border-violet-500 bg-violet-500"
                      : "border-neutral-700 bg-neutral-900"
                  )}
                >
                  {isPast ? (
                    <CheckCircle className="h-4 w-4 text-white" />
                  ) : (
                    <Circle
                      className={cn(
                        "h-4 w-4",
                        isCurrent ? "text-white" : "text-neutral-600"
                      )}
                    />
                  )}
                </div>
                {idx < ORDER_STATE_SEQUENCE.length - 1 && (
                  <div
                    className={cn(
                      "w-0.5 flex-1 min-h-[2rem]",
                      isPast ? "bg-emerald-500/50" : "bg-neutral-800"
                    )}
                  />
                )}
              </div>

              {/* Right: content */}
              <div className="pb-6 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={cn(
                      "font-medium text-sm",
                      isPast
                        ? "text-emerald-400"
                        : isCurrent
                        ? "text-violet-400"
                        : "text-neutral-500"
                    )}
                  >
                    {ORDER_STATE_LABELS[state]}
                  </span>
                  {isCurrent && !isDisputed && (
                    <Badge variant="default" className="text-xs">Current</Badge>
                  )}
                  {payout && (
                    <span className="text-xs text-neutral-500">
                      {(payout.percentageBps / 100).toFixed(0)}% payout
                    </span>
                  )}
                </div>

                {transition && (
                  <p className="text-xs text-neutral-500 mt-0.5">
                    {formatDateTime(transition.timestamp)}
                    {transition.triggeredBy !== "buyer" &&
                      ` · by ${transition.triggeredBy}`}
                  </p>
                )}

                {payout?.releasedAt && (
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-xs text-emerald-400">
                      Paid: {payout.amountToken ? formatToken(payout.amountToken) : "–"}
                    </span>
                    {payout.txHash && (
                      <a
                        href={`${XRPL_EXPLORER_URL}/tx/${payout.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-neutral-500 hover:text-neutral-300 flex items-center gap-0.5"
                      >
                        <ExternalLink className="h-3 w-3" /> tx
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
