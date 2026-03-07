import Link from "next/link";
import Image from "next/image";
import { type Order } from "@/lib/flowstate/types";
import { formatUsd, formatDate } from "@/lib/utils";
import { OrderStatusBadge } from "./OrderStatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronRight, Package } from "lucide-react";

interface OrderCardProps {
  order: Order;
}

export function OrderCard({ order }: OrderCardProps) {
  const firstItem = order.items[0];
  const moreItems = order.items.length - 1;

  return (
    <Link href={`/orders/${order.id}`}>
      <Card className="hover:border-neutral-700 transition-colors cursor-pointer">
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            {/* Image */}
            <div className="relative h-16 w-16 rounded-lg overflow-hidden bg-neutral-800 shrink-0">
              {firstItem?.image_url ? (
                <Image src={firstItem.image_url} alt={firstItem.product_name} fill className="object-cover" />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <Package className="h-6 w-6 text-neutral-600" />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-neutral-100 truncate">
                    {firstItem?.product_name}
                    {moreItems > 0 && (
                      <span className="text-neutral-400"> +{moreItems} more</span>
                    )}
                  </p>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Order #{order.id} · {order.seller_name} · {formatDate(order.created_at)}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-neutral-600 shrink-0 mt-0.5" />
              </div>

              <div className="flex items-center gap-3 mt-2">
                <OrderStatusBadge state={order.state} />
                <span className="text-sm font-semibold text-neutral-200">
                  {formatUsd(order.total_usd)}
                </span>
                {order.tracking_number && (
                  <span className="text-xs text-neutral-500 truncate">
                    {order.carrier} · {order.tracking_number.slice(0, 12)}…
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
