"use client";

import { useEffect } from "react";
import { Package } from "lucide-react";
import Link from "next/link";
import { useOrderStore } from "@/stores/order-store";
import { OrderCard } from "@/components/orders/OrderCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { RequireRole } from "@/components/guards/RequireRole";
function OrdersContent() {
  const { orders, isLoading, fetchOrders } = useOrderStore();

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-neutral-100">My Orders</h1>
            <Link href="/">
              <Button variant="outline" size="sm">
                Continue Shopping
              </Button>
            </Link>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full rounded-xl" />
              ))}
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-16">
              <Package className="h-12 w-12 text-neutral-600 mx-auto mb-4" />
              <p className="text-neutral-500">No orders yet.</p>
              <Link href="/" className="mt-4 inline-block">
                <Button>Start Shopping</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => (
                <OrderCard key={order.id} order={order} />
              ))}
            </div>
          )}
        </div>
    </div>
  );
}

export default function OrdersPage() {
  return (
    <RequireRole roles={["buyer", "seller", "admin"]}>
      <OrdersContent />
    </RequireRole>
  );
}
