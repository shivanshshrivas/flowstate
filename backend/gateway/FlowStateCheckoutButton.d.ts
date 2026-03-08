import type { MouseEventHandler } from "react";

export interface FlowStateCheckoutButtonProps {
  onClick: MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  isConnected: boolean;
  amountLabel?: string;
  className?: string;
  title?: string;
}

export declare function FlowStateCheckoutButton(
  props: FlowStateCheckoutButtonProps
): JSX.Element;