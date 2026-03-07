"use client";

import { useEffect } from "react";
import { useAccount } from "wagmi";
import { Package } from "lucide-react";
import Link from "next/link";
import { useOrderStore } from "@/stores/order-store";
import { OrderCard } from "@/components/orders/OrderCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

export default function OrdersPage() {
  const { isConnected } = useAccount();
  const { orders, isLoading, fetchOrders } = useOrderStore();

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  if (!isConnected) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 text-center">
        <Package className="h-12 w-12 text-neutral-600 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-neutral-300 mb-2">Connect your wallet</h2>
        <p className="text-neutral-500">Connect your wallet to view your orders.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-neutral-100">My Orders</h1>
        <Link href="/">
          <Button variant="outline" size="sm">Continue Shopping</Button>
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
  );
}
