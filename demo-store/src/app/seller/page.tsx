"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  DollarSign,
  Download,
  ExternalLink,
  Package,
  PlusCircle,
  TrendingUp,
} from "lucide-react";
import { RequireRole } from "@/components/guards/RequireRole";
import { OrderStatusBadge } from "@/components/orders/OrderStatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MOCK_PRODUCTS,
  MOCK_PAYOUT_RECORDS,
  MOCK_SELLER_METRICS,
} from "@/lib/mock-data";
import { XRPL_EXPLORER_URL } from "@/lib/constants";
import { EscrowProgressBar, OrderState } from "@/lib/flowstate";
import { formatDate, formatDateTime, formatUsd } from "@/lib/utils";
import { useOrderStore } from "@/stores/order-store";

const SELLER_ID = "seller-001";

const NEXT_STATES: Partial<Record<OrderState, OrderState>> = {
  [OrderState.ESCROWED]: OrderState.LABEL_CREATED,
  [OrderState.LABEL_CREATED]: OrderState.SHIPPED,
};

const ACTION_LABELS: Partial<Record<OrderState, string>> = {
  [OrderState.ESCROWED]: "Confirm Label Printed",
  [OrderState.LABEL_CREATED]: "Confirm Shipped",
};

type SellerOrderFilter = "all" | "needs_action" | "in_transit" | "completed";

const SELLER_FILTERS: { key: SellerOrderFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "needs_action", label: "Needs Action" },
  { key: "in_transit", label: "In Transit" },
  { key: "completed", label: "Completed" },
];

function SellerDashboardContent() {
  const { orders, advanceOrderState } = useOrderStore();
  const [activeFilter, setActiveFilter] = useState<SellerOrderFilter>("all");

  const sellerOrders = orders.filter((order) => order.seller_id === SELLER_ID);
  const filteredOrders = sellerOrders.filter((order) => {
    if (activeFilter === "needs_action") {
      return (
        order.state === OrderState.ESCROWED ||
        order.state === OrderState.LABEL_CREATED
      );
    }
    if (activeFilter === "in_transit") {
      return (
        order.state === OrderState.SHIPPED ||
        order.state === OrderState.IN_TRANSIT
      );
    }
    if (activeFilter === "completed") {
      return (
        order.state === OrderState.DELIVERED ||
        order.state === OrderState.FINALIZED
      );
    }
    return true;
  });

  const metrics = MOCK_SELLER_METRICS;
  const products = MOCK_PRODUCTS.filter((product) => product.seller_id === SELLER_ID);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-100">Seller Dashboard</h1>
          <p className="mt-0.5 text-sm text-neutral-400">TechGear Co. | {SELLER_ID}</p>
        </div>
        <Link href="/seller/products">
          <Button size="sm" variant="outline">
            <PlusCircle className="h-4 w-4" />
            Manage Products
          </Button>
        </Link>
      </div>

      <Tabs defaultValue="orders">
        <TabsList className="mb-6">
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="payouts">Payouts</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
        </TabsList>

        <TabsContent value="orders">
          <div className="space-y-3">
            {sellerOrders.length === 0 ? (
              <div className="py-16 text-center text-neutral-500">
                <Package className="mx-auto mb-3 h-10 w-10 opacity-50" />
                <p>No orders yet.</p>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  {SELLER_FILTERS.map((filter) => (
                    <Button
                      key={filter.key}
                      type="button"
                      size="sm"
                      variant={activeFilter === filter.key ? "default" : "secondary"}
                      onClick={() => setActiveFilter(filter.key)}
                    >
                      {filter.label}
                    </Button>
                  ))}
                </div>

                {filteredOrders.length === 0 ? (
                  <Card>
                    <CardContent className="p-8 text-center text-sm text-neutral-500">
                      No orders match this filter.
                    </CardContent>
                  </Card>
                ) : (
                  filteredOrders.map((order) => {
                    const nextState = NEXT_STATES[order.state];
                    const actionLabel = ACTION_LABELS[order.state];

                    return (
                      <Card key={order.id}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0 flex-1">
                              <div className="mb-1 flex items-center gap-2">
                                <span className="text-sm font-mono text-neutral-400">
                                  {order.id}
                                </span>
                                <OrderStatusBadge state={order.state} />
                              </div>
                              <p className="text-sm text-neutral-300">
                                {order.items.map((item) => item.product_name).join(", ")}
                              </p>
                              <div className="mt-2 flex items-center gap-3 text-xs text-neutral-500">
                                <span>{formatDate(order.created_at)}</span>
                                <span>{formatUsd(order.total_usd)}</span>
                                {order.tracking_number && (
                                  <span className="font-mono">
                                    {order.carrier} | {order.tracking_number.slice(0, 12)}...
                                  </span>
                                )}
                              </div>
                              <EscrowProgressBar
                                className="mt-3"
                                state={order.state}
                                payoutSchedule={order.payout_schedule}
                                compact
                                isDisputed={order.state === OrderState.DISPUTED}
                              />
                            </div>

                            <div className="flex shrink-0 items-center gap-2">
                              {order.label_url && (
                                <a
                                  href={order.label_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <Button size="sm" variant="outline">
                                    <Download className="h-3.5 w-3.5" />
                                    Label
                                  </Button>
                                </a>
                              )}
                              {nextState && actionLabel && (
                                <Button
                                  size="sm"
                                  onClick={() => advanceOrderState(order.id, nextState)}
                                >
                                  <CheckCircle className="h-3.5 w-3.5" />
                                  {actionLabel}
                                </Button>
                              )}
                              <Link href={`/orders/${order.id}`}>
                                <Button size="sm" variant="ghost">
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </Button>
                              </Link>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </>
            )}
          </div>
        </TabsContent>

        <TabsContent value="products">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <Card key={product.id}>
                <div className="relative h-32 overflow-hidden rounded-t-xl">
                  <Image
                    src={product.image_url}
                    alt={product.name}
                    fill
                    className="object-cover"
                  />
                </div>
                <CardContent className="p-3">
                  <p className="truncate text-sm font-medium text-neutral-100">
                    {product.name}
                  </p>
                  <div className="mt-1 flex justify-between text-sm">
                    <span className="text-neutral-400">{formatUsd(product.price_usd)}</span>
                    <span className="text-neutral-500">{product.stock} in stock</span>
                  </div>
                </CardContent>
              </Card>
            ))}
            <Card className="flex h-48 cursor-pointer items-center justify-center border-dashed transition-colors hover:border-neutral-600">
              <div className="text-center text-neutral-600">
                <PlusCircle className="mx-auto mb-2 h-8 w-8" />
                <p className="text-sm">Add Product</p>
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="payouts">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Payout History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {MOCK_PAYOUT_RECORDS.map((payout) => (
                  <div key={payout.id}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-neutral-200">
                          {payout.state.replace("_", " ")} | Order {payout.order_id}
                        </p>
                        <p className="mt-0.5 text-xs text-neutral-500">
                          {formatDateTime(payout.timestamp)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-emerald-400">
                          +{formatUsd(payout.amount_usd)}
                        </p>
                        <a
                          href={`${XRPL_EXPLORER_URL}/tx/${payout.tx_hash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-end gap-0.5 text-xs text-neutral-500 hover:text-neutral-300"
                        >
                          tx <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                    <Separator className="mt-3" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="metrics">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: Package,
                label: "Total Orders",
                value: metrics.total_orders.toString(),
                sub: `${metrics.active_escrows} in progress`,
                color: "text-violet-400",
              },
              {
                icon: DollarSign,
                label: "Total Revenue",
                value: formatUsd(metrics.total_revenue_usd),
                sub: `${formatUsd(Number(metrics.pending_payouts_token) / 1e18)} pending`,
                color: "text-emerald-400",
              },
              {
                icon: Clock,
                label: "Avg Fulfillment",
                value: `${metrics.fulfillment_avg_hours.toFixed(1)}h`,
                sub: "from order to shipped",
                color: "text-blue-400",
              },
              {
                icon: AlertTriangle,
                label: "Dispute Rate",
                value: `${(metrics.dispute_rate * 100).toFixed(1)}%`,
                sub: "industry avg: 2.5%",
                color: "text-amber-400",
              },
              {
                icon: TrendingUp,
                label: "Active Orders",
                value: metrics.active_escrows.toString(),
                sub: "awaiting fulfillment",
                color: "text-violet-400",
              },
            ].map(({ icon: Icon, label, value, sub, color }) => (
              <Card key={label}>
                <CardContent className="p-5">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-800">
                      <Icon className={`h-4 w-4 ${color}`} />
                    </div>
                    <p className="text-sm text-neutral-400">{label}</p>
                  </div>
                  <p className="text-2xl font-bold text-neutral-100">{value}</p>
                  <p className="mt-1 text-xs text-neutral-500">{sub}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function SellerDashboardPage() {
  return (
    <RequireRole roles={["seller", "admin"]}>
      <SellerDashboardContent />
    </RequireRole>
  );
}
