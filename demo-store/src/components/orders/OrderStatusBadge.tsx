import { type OrderState, ORDER_STATE_LABELS } from "@shivanshshrivas/flowstate";
import { Badge } from "@/components/ui/badge";

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "success" | "warning" | "destructive" | "info" | "outline"> = {
  INITIATED: "secondary",
  ESCROWED: "info",
  LABEL_CREATED: "info",
  SHIPPED: "warning",
  IN_TRANSIT: "warning",
  DELIVERED: "success",
  FINALIZED: "success",
  DISPUTED: "destructive",
};

interface OrderStatusBadgeProps {
  state: OrderState;
}

export function OrderStatusBadge({ state }: OrderStatusBadgeProps) {
  return (
    <Badge variant={STATUS_VARIANTS[state] ?? "secondary"}>
      {ORDER_STATE_LABELS[state]}
    </Badge>
  );
}
