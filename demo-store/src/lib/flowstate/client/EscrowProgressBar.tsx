"use client";

import { AlertTriangle, CheckCircle, Circle } from "lucide-react";
import {
  type PayoutSchedule,
  OrderState,
  ORDER_STATE_LABELS,
  ORDER_STATE_SEQUENCE,
} from "../types";
import { cn } from "@/lib/utils";

export interface EscrowProgressBarProps {
  state: OrderState;
  payoutSchedule?: PayoutSchedule[];
  isDisputed?: boolean;
  compact?: boolean;
  className?: string;
}

export function EscrowProgressBar({
  state,
  payoutSchedule,
  isDisputed,
  compact = false,
  className,
}: EscrowProgressBarProps) {
  const isDisputedState = state === OrderState.DISPUTED || Boolean(isDisputed);
  const currentIdx = ORDER_STATE_SEQUENCE.indexOf(state);
  const activeIdx = currentIdx === -1 ? 0 : currentIdx;

  const payoutByState = new Map<OrderState, PayoutSchedule>(
    (payoutSchedule ?? []).map((payout) => [payout.state, payout])
  );

  return (
    <div className={cn("space-y-2", className)}>
      <div className="overflow-x-auto pb-1">
        <div className={cn("relative", compact ? "min-w-0" : "w-max min-w-full")}>
          {isDisputedState && (
            <div className="pointer-events-none absolute inset-x-2 top-0 z-20 flex justify-center">
              <div
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border border-red-700/70 bg-red-950/90 px-3 py-1 text-[11px] font-medium text-red-200",
                  compact && "text-[10px]"
                )}
              >
                <AlertTriangle
                  className={cn("h-3.5 w-3.5 shrink-0", compact && "h-3 w-3")}
                />
                Disputed: funds frozen pending review
              </div>
            </div>
          )}

          <div
            className={cn(
              "flex items-start",
              isDisputedState && (compact ? "pt-6" : "pt-8"),
              isDisputedState && "opacity-55"
            )}
          >
            {ORDER_STATE_SEQUENCE.map((step, idx) => {
              const stepLabel = ORDER_STATE_LABELS[step];
              const isPast = !isDisputedState && idx < activeIdx;
              const isCurrent = !isDisputedState && idx === activeIdx;
              const isCompletedConnector = !isDisputedState && idx < activeIdx;
              const payout = payoutByState.get(step);
              const isLast = idx === ORDER_STATE_SEQUENCE.length - 1;

              return (
                <div
                  key={step}
                  className={cn(
                    "flex items-start",
                    compact ? (isLast ? "shrink-0" : "min-w-0 flex-1") : "flex-none min-w-[7rem] md:min-w-[7.5rem]"
                  )}
                >
                  <div className={cn("flex shrink-0 flex-col items-center", !compact && "w-full")}>
                    <div
                      title={stepLabel}
                      aria-label={stepLabel}
                      className={cn(
                        "relative flex items-center justify-center rounded-full border-2 font-semibold transition-colors",
                        compact ? "h-4 w-4 text-[9px]" : "h-8 w-8 text-xs",
                        isPast
                          ? "border-emerald-500 bg-emerald-500 text-white"
                          : isCurrent
                          ? "border-violet-500 bg-violet-500 text-white"
                          : "border-neutral-700 bg-neutral-900 text-neutral-500"
                      )}
                    >
                      {isPast ? (
                        <CheckCircle className={cn(compact ? "h-2.5 w-2.5" : "h-4 w-4")} />
                      ) : (
                        <>
                          <Circle
                            className={cn(
                              "absolute inset-0 m-auto",
                              compact ? "h-3.5 w-3.5" : "h-6 w-6",
                              isCurrent ? "text-white/80" : "text-neutral-600"
                            )}
                          />
                          <span className="relative z-10 leading-none">{idx + 1}</span>
                        </>
                      )}

                      {isCurrent && (
                        <>
                          <span
                            className={cn(
                              "pointer-events-none absolute inset-0 rounded-full ring-4 ring-violet-500/20",
                              compact && "ring-2"
                            )}
                          />
                          <span
                            className={cn(
                              "pointer-events-none absolute -inset-1 rounded-full border border-violet-400/40 animate-pulse",
                              compact && "-inset-0.5"
                            )}
                          />
                        </>
                      )}
                    </div>

                    {!compact && (
                      <div className="mt-2 hidden w-full px-1 text-center sm:block">
                        <p
                          className={cn(
                            "break-words text-[11px] font-medium leading-tight",
                            isPast
                              ? "text-emerald-400"
                              : isCurrent
                              ? "text-violet-300"
                              : "text-neutral-500"
                          )}
                        >
                          {stepLabel}
                        </p>
                        {payout && (
                          <p className="mt-0.5 text-[10px] text-neutral-500">
                            {(payout.percentageBps / 100).toFixed(0)}% payout
                          </p>
                        )}
                      </div>
                    )}

                    {!compact && isCurrent && (
                      <span className="mt-2 hidden rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-violet-200 sm:inline-flex">
                        Current
                      </span>
                    )}
                  </div>

                  {!isLast && (
                    <div
                      className={cn(
                        compact
                          ? "mx-1 mt-1.5 h-0.5 min-w-[0.75rem] flex-1 rounded-full sm:mx-1"
                          : "mx-1.5 mt-3.5 h-0.5 w-4 rounded-full sm:w-5 md:w-7 lg:w-8",
                        isCompletedConnector ? "bg-emerald-500" : "bg-neutral-800"
                      )}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
