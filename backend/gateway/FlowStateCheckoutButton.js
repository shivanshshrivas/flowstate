"use client";

import React from "react";

export function FlowStateCheckoutButton({
  onClick,
  disabled = false,
  isConnected,
  amountLabel,
  className,
  title,
}) {
  const label = isConnected
    ? `Pay with FlowState${amountLabel ? ` ${amountLabel}` : ""}`
    : "Connect Wallet to Checkout";

  return React.createElement(
    "button",
    {
      type: "button",
      onClick,
      disabled,
      title,
      className: [
        "inline-flex h-10 w-full items-center justify-center rounded-md px-4 text-sm font-medium",
        "bg-violet-600 text-white transition-colors",
        "hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className || "",
      ].join(" "),
    },
    label
  );
}
