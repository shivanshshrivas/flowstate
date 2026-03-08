"use client";

import { use, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ChevronLeft,
  ExternalLink,
  Package,
  Truck,
  MapPin,
} from "lucide-react";
import { useOrderStore } from "@/stores/order-store";
import { EscrowProgressBar, OrderState, OrderTracker } from "@/lib/flowstate";
import { OrderStatusBadge } from "@/components/orders/OrderStatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatUsd, formatDate, shortenAddress } from "@/lib/utils";
import { XRPL_EXPLORER_URL } from "@/lib/constants";

interface PageProps {
  params: Promise<{ id: string }>;
}

const NEXT_STATES: Partial<Record<OrderState, OrderState>> = {
  [OrderState.ESCROWED]: OrderState.LABEL_CREATED,
  [OrderState.LABEL_CREATED]: OrderState.SHIPPED,
  [OrderState.SHIPPED]: OrderState.IN_TRANSIT,
  [OrderState.IN_TRANSIT]: OrderState.DELIVERED,
  [OrderState.DELIVERED]: OrderState.FINALIZED,
};

const ADVANCE_LABELS: Partial<Record<OrderState, string>> = {
  [OrderState.ESCROWED]: "Confirm Label Printed",
  [OrderState.LABEL_CREATED]: "Confirm Shipped",
  [OrderState.SHIPPED]: "Advance to In Transit",
  [OrderState.IN_TRANSIT]: "Confirm Delivered",
  [OrderState.DELIVERED]: "Finalize Order",
};

export default function OrderDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const { orders, fetchOrders, advanceOrderState } = useOrderStore();
  const order = orders.find((o) => o.id === id);

  useEffect(() => {
    if (!order) fetchOrders();
  }, [order, fetchOrders]);

  if (!order) {
    return (
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-16 text-center">
        <Package className="h-12 w-12 text-neutral-600 mx-auto mb-4" />
        <p className="text-neutral-500">Order not found.</p>
        <Link href="/orders" className="mt-4 inline-block">
          <Button variant="outline">Back to Orders</Button>
        </Link>
      </div>
    );
  }

  const nextState = NEXT_STATES[order.state];
  const nextLabel = ADVANCE_LABELS[order.state];

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/orders">
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ChevronLeft className="h-4 w-4" />
            Orders
          </Button>
        </Link>
        <Separator orientation="vertical" className="h-5" />
        <span className="text-sm text-neutral-400 font-mono">{order.id}</span>
        <OrderStatusBadge state={order.state} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Progress Snapshot</CardTitle>
            </CardHeader>
            <CardContent>
              <EscrowProgressBar
                state={order.state}
                payoutSchedule={order.payout_schedule}
                isDisputed={order.state === OrderState.DISPUTED}
              />
            </CardContent>
          </Card>

          {/* Order Tracker */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Order Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <OrderTracker order={order} />
            </CardContent>
          </Card>

          {/* Items */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Items</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {order.items.map((item) => (
                <div key={item.product_id} className="flex gap-3">
                  {item.image_url && (
                    <div className="relative h-14 w-14 rounded-lg overflow-hidden bg-neutral-800 shrink-0">
                      <Image src={item.image_url} alt={item.product_name} fill className="object-cover" />
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-medium text-neutral-100">{item.product_name}</p>
                    <p className="text-xs text-neutral-400">Qty: {item.quantity}</p>
                  </div>
                  <p className="text-sm font-semibold">{formatUsd(item.price_usd * item.quantity)}</p>
                </div>
              ))}
              <Separator />
              <div className="flex justify-between text-sm">
                <span className="text-neutral-400">Shipping ({order.shipping_option?.carrier} {order.shipping_option?.service})</span>
                <span>{formatUsd(order.shipping_option?.price_usd ?? 0)}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>Total</span>
                <span>{formatUsd(order.total_usd)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Payout Schedule */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Escrow Payout Schedule</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {order.payout_schedule.map((p) => (
                  <div key={p.state} className="flex items-center justify-between text-sm">
                    <span className={p.releasedAt ? "text-emerald-400" : "text-neutral-400"}>
                      {p.label}
                    </span>
                    <div className="flex items-center gap-2">
                      {p.releasedAt ? (
                        <>
                          <span className="text-emerald-400 text-xs">Released {formatDate(p.releasedAt)}</span>
                          {p.txHash && (
                            <a
                              href={`${XRPL_EXPLORER_URL}/tx/${p.txHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-neutral-500 hover:text-neutral-300"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </>
                      ) : (
                        <span className="text-neutral-600">Pending</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Demo advance */}
          {nextState && nextLabel && (
            <Card className="border-violet-800/50">
              <CardHeader>
                <CardTitle className="text-sm text-violet-300">Demo Controls</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-neutral-400 mb-3">
                  Simulate the next state transition for demo purposes.
                </p>
                <Button
                  className="w-full"
                  size="sm"
                  onClick={() => advanceOrderState(order.id, nextState)}
                >
                  {nextLabel}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Escrow details */}
          {order.escrow && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Escrow Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                <div>
                  <p className="text-neutral-500">Transaction</p>
                  <a
                    href={`${XRPL_EXPLORER_URL}/tx/${order.escrow.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-violet-400 hover:underline flex items-center gap-1 font-mono break-all"
                  >
                    {order.escrow.txHash.slice(0, 20)}…
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                </div>
                <div>
                  <p className="text-neutral-500">Contract</p>
                  <p className="text-neutral-300 font-mono">{shortenAddress(order.escrow.contractAddress)}</p>
                </div>
                <div>
                  <p className="text-neutral-500">Block</p>
                  <p className="text-neutral-300">#{order.escrow.blockNumber.toLocaleString()}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Shipping address */}
          {order.shipping_address && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Shipping Address
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-neutral-300 space-y-0.5">
                <p className="font-medium">{order.shipping_address.name}</p>
                <p>{order.shipping_address.address1}</p>
                <p>
                  {order.shipping_address.city}, {order.shipping_address.state}{" "}
                  {order.shipping_address.zip}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Tracking */}
          {order.tracking_number && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Truck className="h-4 w-4" />
                  Tracking
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                <p className="text-neutral-400">{order.carrier}</p>
                <p className="font-mono text-neutral-300 text-xs break-all mt-1">
                  {order.tracking_number}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Order dates */}
          <Card>
            <CardContent className="pt-4 text-xs text-neutral-500 space-y-1">
              <div className="flex justify-between">
                <span>Placed</span>
                <span>{formatDate(order.created_at)}</span>
              </div>
              <div className="flex justify-between">
                <span>Updated</span>
                <span>{formatDate(order.updated_at)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
