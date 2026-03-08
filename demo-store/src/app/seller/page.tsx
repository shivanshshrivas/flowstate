"use client";

import { useEffect, useMemo, useState } from "react";
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
  type Order,
  type PayoutRecord,
  type Product,
  type Seller,
  type SellerMetrics,
  EscrowProgressBar,
  OrderState,
} from "@/lib/flowstate";
import { XRPL_EXPLORER_URL } from "@/lib/constants";
import { formatDate, formatDateTime, formatUsd } from "@/lib/utils";
import { useOrderStore } from "@/stores/order-store";
import { useUserStore } from "@/stores/user-store";

const DEFAULT_SELLER_ID = "seller-001";
const DEFAULT_SELLER_NAME = "Seller";

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

function toBigIntToken(order: Order): bigint {
  try {
    return BigInt(order.total_token);
  } catch {
    return BigInt(Math.round(order.total_usd * 1e18));
  }
}

function deriveMetrics(orders: Order[]): SellerMetrics {
  let totalRevenueToken = BigInt(0);
  let pendingPayoutToken = BigInt(0);
  let activeEscrows = 0;
  let disputeCount = 0;
  let fulfillmentHoursTotal = 0;
  let fulfillmentSamples = 0;

  for (const order of orders) {
    const orderToken = toBigIntToken(order);
    totalRevenueToken += orderToken;

    if (
      [
        OrderState.INITIATED,
        OrderState.ESCROWED,
        OrderState.LABEL_CREATED,
        OrderState.SHIPPED,
        OrderState.IN_TRANSIT,
      ].includes(order.state)
    ) {
      activeEscrows += 1;
    }

    if (order.state === OrderState.DISPUTED) {
      disputeCount += 1;
    }

    const releasedBps = order.payout_schedule.reduce((sum, payout) => {
      return payout.releasedAt ? sum + payout.percentageBps : sum;
    }, 0);
    const pendingBps = Math.max(0, 10000 - releasedBps);
    pendingPayoutToken += (orderToken * BigInt(pendingBps)) / BigInt(10000);

    const shippedTransition = order.state_history.find(
      (transition) => transition.to === OrderState.SHIPPED
    );
    if (shippedTransition) {
      const createdAtMs = Date.parse(order.created_at);
      const shippedAtMs = Date.parse(shippedTransition.timestamp);
      if (
        Number.isFinite(createdAtMs) &&
        Number.isFinite(shippedAtMs) &&
        shippedAtMs >= createdAtMs
      ) {
        fulfillmentHoursTotal += (shippedAtMs - createdAtMs) / (1000 * 60 * 60);
        fulfillmentSamples += 1;
      }
    }
  }

  const totalRevenueUsd = orders.reduce((sum, order) => sum + order.total_usd, 0);
  const fulfillmentAvgHours =
    fulfillmentSamples > 0 ? fulfillmentHoursTotal / fulfillmentSamples : 0;
  const disputeRate = orders.length > 0 ? disputeCount / orders.length : 0;

  return {
    total_orders: orders.length,
    total_revenue_usd: totalRevenueUsd,
    total_revenue_token: totalRevenueToken.toString(),
    fulfillment_avg_hours: fulfillmentAvgHours,
    dispute_rate: disputeRate,
    active_escrows: activeEscrows,
    pending_payouts_token: pendingPayoutToken.toString(),
  };
}

function derivePayouts(orders: Order[]): PayoutRecord[] {
  const records: PayoutRecord[] = [];

  for (const order of orders) {
    const orderToken = toBigIntToken(order);
    order.payout_schedule.forEach((payout, index) => {
      if (!payout.releasedAt && !payout.txHash) {
        return;
      }

      const amountToken =
        payout.amountToken ??
        ((orderToken * BigInt(payout.percentageBps)) / BigInt(10000)).toString();

      records.push({
        id: `${order.id}-${payout.state}-${index}`,
        order_id: order.id,
        state: payout.state,
        amount_token: amountToken,
        amount_usd: (order.total_usd * payout.percentageBps) / 10000,
        tx_hash: payout.txHash ?? `pending-${order.id}-${index}`,
        timestamp: payout.releasedAt ?? order.updated_at,
      });
    });
  }

  return records.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
}

function SellerDashboardContent() {
  const { user } = useUserStore();
  const { orders, fetchOrders, advanceOrderState } = useOrderStore();
  const [activeFilter, setActiveFilter] = useState<SellerOrderFilter>("all");
  const [sellerId, setSellerId] = useState<string>(user?.seller_id ?? DEFAULT_SELLER_ID);
  const [sellerName, setSellerName] = useState<string>(DEFAULT_SELLER_NAME);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadSellerProfile() {
      try {
        const response = await fetch("/api/sellers?mine=true", { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as { seller?: Seller | null };
        if (cancelled || !payload.seller) return;

        setSellerId(payload.seller.id);
        setSellerName(payload.seller.business_name);
      } catch {
        if (!cancelled && user?.seller_id) {
          setSellerId(user.seller_id);
        }
      }
    }

    loadSellerProfile();
    return () => {
      cancelled = true;
    };
  }, [user?.seller_id]);

  useEffect(() => {
    let cancelled = false;

    async function loadProducts() {
      if (!sellerId) return;

      setLoadingProducts(true);
      try {
        const response = await fetch(
          `/api/products?seller_id=${encodeURIComponent(sellerId)}`,
          { cache: "no-store" }
        );
        if (!response.ok) return;

        const payload = (await response.json()) as { products?: Product[] };
        if (!cancelled) {
          setProducts(payload.products ?? []);
        }
      } finally {
        if (!cancelled) {
          setLoadingProducts(false);
        }
      }
    }

    loadProducts();
    return () => {
      cancelled = true;
    };
  }, [sellerId]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const sellerOrders = useMemo(
    () => orders.filter((order) => order.seller_id === sellerId),
    [orders, sellerId]
  );

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

  const metrics = useMemo(() => deriveMetrics(sellerOrders), [sellerOrders]);
  const payoutRecords = useMemo(() => derivePayouts(sellerOrders), [sellerOrders]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-100">Seller Dashboard</h1>
          <p className="mt-0.5 text-sm text-neutral-400">
            {sellerName} | {sellerId}
          </p>
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
            {loadingProducts && products.length === 0 && (
              <Card>
                <CardContent className="p-6 text-sm text-neutral-500">
                  Loading products...
                </CardContent>
              </Card>
            )}

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
              {payoutRecords.length === 0 ? (
                <p className="text-sm text-neutral-500">No payout releases yet.</p>
              ) : (
                <div className="space-y-3">
                  {payoutRecords.map((payout) => (
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
              )}
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
                sub: "share of disputed orders",
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
