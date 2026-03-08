"use client";

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
  MOCK_ANALYTICS,
  MOCK_SELLERS,
  MOCK_WEBHOOK_EVENTS,
} from "@/lib/mock-data";
import {
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

function AdminDashboardContent() {
  const analytics = MOCK_ANALYTICS;
  const { orders } = useOrderStore();

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
            {MOCK_SELLERS.map((seller) => (
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
          </div>
        </TabsContent>

        <TabsContent value="webhooks">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Webhook Events</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {MOCK_WEBHOOK_EVENTS.map((event) => (
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
