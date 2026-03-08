"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle,
  Clock,
  DollarSign,
  Shield,
  XCircle,
} from "lucide-react";
import { RequireRole } from "@/components/guards/RequireRole";
import { OrderStatusBadge } from "@/components/orders/OrderStatusBadge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  type Order,
  type Seller,
  type WebhookEvent,
  EscrowProgressBar,
  OrderState,
  ORDER_STATE_LABELS,
  ORDER_STATE_SEQUENCE,
} from "@/lib/flowstate";
import { formatDateTime, formatUsd } from "@/lib/utils";
import { useOrderStore } from "@/stores/order-store";

type PipelineState = (typeof ORDER_STATE_SEQUENCE)[number];

function isPipelineState(state: OrderState): state is PipelineState {
  return ORDER_STATE_SEQUENCE.includes(state);
}

function deriveAnalytics(orders: Order[]) {
  const totalOrders = orders.length;
  const totalVolumeUsd = orders.reduce((sum, order) => sum + order.total_usd, 0);

  const activeEscrows = orders.filter((order) =>
    [
      OrderState.INITIATED,
      OrderState.ESCROWED,
      OrderState.LABEL_CREATED,
      OrderState.SHIPPED,
      OrderState.IN_TRANSIT,
    ].includes(order.state)
  ).length;

  const disputed = orders.filter((order) => order.state === OrderState.DISPUTED).length;
  const disputeRate = totalOrders > 0 ? disputed / totalOrders : 0;

  const resolvedDurations = orders
    .filter((order) =>
      [OrderState.DELIVERED, OrderState.FINALIZED, OrderState.DISPUTED].includes(order.state)
    )
    .map((order) => {
      const start = Date.parse(order.created_at);
      const end = Date.parse(order.updated_at);
      if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;
      return (end - start) / (1000 * 60 * 60);
    })
    .filter((hours) => hours > 0);

  const avgResolutionHours =
    resolvedDurations.length > 0
      ? resolvedDurations.reduce((sum, hours) => sum + hours, 0) / resolvedDurations.length
      : 0;

  const byDay = new Map<string, { date: string; count: number; volume_usd: number }>();
  for (const order of orders) {
    const date = order.created_at.slice(0, 10);
    const existing = byDay.get(date);
    if (existing) {
      existing.count += 1;
      existing.volume_usd += order.total_usd;
    } else {
      byDay.set(date, { date, count: 1, volume_usd: order.total_usd });
    }
  }

  const ordersByDay = Array.from(byDay.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-14);

  if (ordersByDay.length === 0) {
    ordersByDay.push({
      date: new Date().toISOString().slice(0, 10),
      count: 0,
      volume_usd: 0,
    });
  }

  return {
    total_orders: totalOrders,
    total_volume_usd: totalVolumeUsd,
    active_escrows: activeEscrows,
    dispute_rate: disputeRate,
    avg_resolution_hours: avgResolutionHours,
    orders_by_day: ordersByDay,
  };
}

function AdminDashboardContent() {
  const { orders, fetchOrders } = useOrderStore();
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [webhookEvents, setWebhookEvents] = useState<WebhookEvent[]>([]);
  const [loadingPlatformData, setLoadingPlatformData] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    let cancelled = false;

    async function loadPlatformData() {
      setLoadingPlatformData(true);
      try {
        const [sellersResponse, webhooksResponse] = await Promise.all([
          fetch("/api/sellers", { cache: "no-store" }),
          fetch("/api/webhooks/events?limit=25", { cache: "no-store" }),
        ]);

        if (!cancelled && sellersResponse.ok) {
          const payload = (await sellersResponse.json()) as { sellers?: Seller[] };
          setSellers(payload.sellers ?? []);
        }

        if (!cancelled && webhooksResponse.ok) {
          const payload = (await webhooksResponse.json()) as { events?: WebhookEvent[] };
          setWebhookEvents(payload.events ?? []);
        }
      } finally {
        if (!cancelled) setLoadingPlatformData(false);
      }
    }

    loadPlatformData();
    return () => {
      cancelled = true;
    };
  }, []);

  const analytics = useMemo(() => deriveAnalytics(orders), [orders]);

  const pipelineCounts = ORDER_STATE_SEQUENCE.reduce(
    (counts, state) => ({ ...counts, [state]: 0 }),
    {} as Record<PipelineState, number>
  );
  let disputedCount = 0;

  for (const order of orders) {
    if (isPipelineState(order.state)) {
      pipelineCounts[order.state] += 1;
    } else if (order.state === OrderState.DISPUTED) {
      disputedCount += 1;
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-100">Admin Dashboard</h1>
          <p className="mt-0.5 text-sm text-neutral-400">
            Platform overview | FlowState Demo
          </p>
        </div>
      </div>

      <Tabs defaultValue="analytics">
        <TabsList className="mb-6">
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="sellers">Sellers</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
        </TabsList>

        <TabsContent value="analytics">
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  icon: BarChart3,
                  label: "Total Orders",
                  value: analytics.total_orders.toLocaleString(),
                  color: "text-violet-400",
                },
                {
                  icon: DollarSign,
                  label: "Total Volume",
                  value: formatUsd(analytics.total_volume_usd),
                  color: "text-emerald-400",
                },
                {
                  icon: Shield,
                  label: "Active Orders",
                  value: analytics.active_escrows.toString(),
                  color: "text-blue-400",
                },
                {
                  icon: AlertTriangle,
                  label: "Dispute Rate",
                  value: `${(analytics.dispute_rate * 100).toFixed(1)}%`,
                  color: "text-amber-400",
                },
              ].map(({ icon: Icon, label, value, color }) => (
                <Card key={label}>
                  <CardContent className="p-5">
                    <div className="mb-3 flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-800">
                        <Icon className={`h-4 w-4 ${color}`} />
                      </div>
                      <p className="text-sm text-neutral-400">{label}</p>
                    </div>
                    <p className="text-2xl font-bold text-neutral-100">{value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Orders by Day</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={analytics.orders_by_day}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                      <XAxis
                        dataKey="date"
                        tick={{ fill: "#737373", fontSize: 11 }}
                        tickFormatter={(value) => value.slice(5)}
                      />
                      <YAxis tick={{ fill: "#737373", fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#171717",
                          border: "1px solid #262626",
                          borderRadius: 8,
                        }}
                        labelStyle={{ color: "#a3a3a3" }}
                        itemStyle={{ color: "#a78bfa" }}
                      />
                      <Bar dataKey="count" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Revenue by Day (USD)</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={analytics.orders_by_day}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                      <XAxis
                        dataKey="date"
                        tick={{ fill: "#737373", fontSize: 11 }}
                        tickFormatter={(value) => value.slice(5)}
                      />
                      <YAxis tick={{ fill: "#737373", fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#171717",
                          border: "1px solid #262626",
                          borderRadius: 8,
                        }}
                        labelStyle={{ color: "#a3a3a3" }}
                        itemStyle={{ color: "#34d399" }}
                        formatter={(value) => formatUsd(Number(value))}
                      />
                      <Line
                        type="monotone"
                        dataKey="volume_usd"
                        stroke="#10b981"
                        strokeWidth={2}
                        dot={{ fill: "#10b981", r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardContent className="flex items-center gap-3 p-5">
                <Clock className="h-4 w-4 text-neutral-400" />
                <span className="text-sm text-neutral-400">
                  Avg dispute resolution:{" "}
                  <span className="font-semibold text-neutral-200">
                    {analytics.avg_resolution_hours.toFixed(1)} hours
                  </span>
                </span>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="orders">
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
              {ORDER_STATE_SEQUENCE.map((state) => (
                <Card key={state}>
                  <CardContent className="p-3 text-center">
                    <p className="text-[10px] leading-tight text-neutral-500">
                      {ORDER_STATE_LABELS[state]}
                    </p>
                    <p className="mt-1 text-lg font-semibold text-neutral-100">
                      {pipelineCounts[state]}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {disputedCount > 0 && (
              <Card className="border-red-900/70 bg-red-950/20">
                <CardContent className="p-3 text-sm text-red-200">
                  {disputedCount} disputed{" "}
                  {disputedCount === 1 ? "order is" : "orders are"} frozen pending
                  review.
                </CardContent>
              </Card>
            )}

            <div className="space-y-3">
              {orders.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center text-sm text-neutral-500">
                    No orders found.
                  </CardContent>
                </Card>
              ) : (
                orders.map((order) => (
                  <Card key={order.id}>
                    <CardContent className="p-4">
                      <div className="flex flex-col gap-3">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs font-mono text-neutral-500">
                                {order.id}
                              </span>
                              <OrderStatusBadge state={order.state} />
                            </div>
                            <p className="mt-1 text-sm text-neutral-200">
                              {order.seller_name ?? order.seller_id}
                            </p>
                            <p className="mt-0.5 text-xs text-neutral-500">
                              Updated {formatDateTime(order.updated_at)} |{" "}
                              {formatUsd(order.total_usd)}
                            </p>
                          </div>
                        </div>
                        <EscrowProgressBar
                          state={order.state}
                          payoutSchedule={order.payout_schedule}
                          compact
                          isDisputed={order.state === OrderState.DISPUTED}
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="sellers">
          <div className="space-y-3">
            {loadingPlatformData && sellers.length === 0 && (
              <Card>
                <CardContent className="p-8 text-center text-sm text-neutral-500">
                  Loading sellers...
                </CardContent>
              </Card>
            )}

            {sellers.map((seller) => (
              <Card key={seller.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="mb-1 flex items-center gap-2">
                        <p className="font-semibold text-neutral-100">
                          {seller.business_name}
                        </p>
                        <Badge
                          variant={
                            seller.status === "active"
                              ? "success"
                              : seller.status === "suspended"
                              ? "destructive"
                              : "secondary"
                          }
                        >
                          {seller.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-neutral-400">{seller.email}</p>
                      <p className="mt-0.5 text-xs font-mono text-neutral-500">
                        {seller.wallet_address}
                      </p>
                    </div>
                    <div className="text-right text-sm">
                      <p className="text-neutral-300">
                        {seller.address.city}, {seller.address.state}
                      </p>
                      <p className="mt-0.5 text-xs text-neutral-500">
                        Since {new Date(seller.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <Separator className="my-3" />
                  <div className="flex items-center gap-4 text-xs text-neutral-500">
                    <span>
                      Immediate: {(seller.payout_config.immediate_bps / 100).toFixed(0)}%
                    </span>
                    <span>
                      Milestone: {(seller.payout_config.milestone_bps / 100).toFixed(0)}%
                    </span>
                    <span>
                      Holdback: {(seller.payout_config.holdback_bps / 100).toFixed(0)}%
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}

            {!loadingPlatformData && sellers.length === 0 && (
              <Card>
                <CardContent className="p-8 text-center text-sm text-neutral-500">
                  No sellers found.
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="webhooks">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Webhook Events</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {loadingPlatformData && webhookEvents.length === 0 && (
                  <p className="text-sm text-neutral-500">Loading webhook events...</p>
                )}

                {webhookEvents.map((event) => (
                  <div key={event.id}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        {event.status === "processed" ? (
                          <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                        ) : (
                          <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                        )}
                        <div>
                          <p className="text-sm font-medium text-neutral-200">
                            {event.event_type}
                          </p>
                          <div className="mt-0.5 flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs">
                              {event.source}
                            </Badge>
                            {event.order_id && (
                              <span className="text-xs text-neutral-500">
                                {event.order_id}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="shrink-0 text-right text-xs text-neutral-500">
                        <p>{formatDateTime(event.timestamp)}</p>
                        {event.http_status && (
                          <p
                            className={
                              event.http_status === 200
                                ? "text-emerald-500"
                                : "text-red-500"
                            }
                          >
                            HTTP {event.http_status}
                          </p>
                        )}
                      </div>
                    </div>
                    <Separator className="mt-3" />
                  </div>
                ))}

                {!loadingPlatformData && webhookEvents.length === 0 && (
                  <p className="text-sm text-neutral-500">No webhook events found.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function AdminDashboardPage() {
  return (
    <RequireRole roles={["admin"]}>
      <AdminDashboardContent />
    </RequireRole>
  );
}
