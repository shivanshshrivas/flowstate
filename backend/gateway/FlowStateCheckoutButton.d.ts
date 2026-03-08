import type { MouseEventHandler } from "react";
export interface FlowStateCheckoutButtonProps {
    onClick: MouseEventHandler<HTMLButtonElement>;
    disabled?: boolean;
    isConnected: boolean;
    amountLabel?: string;
    className?: string;
    title?: string;
}
export declare function FlowStateCheckoutButton({ onClick, disabled, isConnected, amountLabel, className, title, }: FlowStateCheckoutButtonProps): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=FlowStateCheckoutButton.d.ts.map