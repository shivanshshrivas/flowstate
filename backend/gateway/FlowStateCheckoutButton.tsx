"use client";

import type { MouseEventHandler } from "react";

export interface FlowStateCheckoutButtonProps {
  onClick: MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  isConnected: boolean;
  amountLabel?: string;
  className?: string;
  title?: string;
}

export function FlowStateCheckoutButton({
  onClick,
  disabled = false,
  isConnected,
  amountLabel,
  className,
  title,
}: FlowStateCheckoutButtonProps) {
  const label = isConnected
    ? `Pay with FlowState${amountLabel ? ` ${amountLabel}` : ""}`
    : "Connect Wallet to Checkout";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={[
        "inline-flex h-10 w-full items-center justify-center rounded-md px-4 text-sm font-medium",
        "bg-violet-600 text-white transition-colors",
        "hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className ?? "",
      ].join(" ")}
    >
      {label}
    </button>
  );
}
