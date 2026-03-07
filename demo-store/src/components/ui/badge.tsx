import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-violet-600 text-white",
        secondary: "border-transparent bg-neutral-700 text-neutral-200",
        destructive: "border-transparent bg-red-600 text-white",
        outline: "border-neutral-700 text-neutral-300",
        success: "border-transparent bg-emerald-600 text-white",
        warning: "border-transparent bg-amber-600 text-white",
        info: "border-transparent bg-blue-600 text-white",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
