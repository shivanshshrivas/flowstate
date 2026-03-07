"use client";

import { RequireRole } from "@/components/guards/RequireRole";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { OrderStatusBadge } from "@/components/orders/OrderStatusBadge";
import {
  Package, TrendingUp, DollarSign, Clock, AlertTriangle,
  Download, CheckCircle, ExternalLink, PlusCircle, BotMessageSquare
} from "lucide-react";
import { MOCK_ORDERS, MOCK_SELLER_METRICS, MOCK_PAYOUT_RECORDS, MOCK_PRODUCTS } from "@/lib/mock-data";
import { formatUsd, formatDate, formatDateTime } from "@/lib/utils";
import { XRPL_EXPLORER_URL } from "@/lib/constants";
import Link from "next/link";
import Image from "next/image";
import { useOrderStore } from "@/stores/order-store";
import { OrderState } from "@/lib/flowstate/types";
import AgentChat from "@/components/chat/AgentChat";

const SELLER_ID = "seller-001";

const NEXT_STATES: Partial<Record<OrderState, OrderState>> = {
  [OrderState.ESCROWED]: OrderState.LABEL_CREATED,
  [OrderState.LABEL_CREATED]: OrderState.SHIPPED,
};

const ACTION_LABELS: Partial<Record<OrderState, string>> = {
  [OrderState.ESCROWED]: "Confirm Label Printed",
  [OrderState.LABEL_CREATED]: "Confirm Shipped",
};

function SellerDashboardContent() {
  const { orders, advanceOrderState } = useOrderStore();
  const sellerOrders = orders.filter((o) => o.seller_id === SELLER_ID);
  const metrics = MOCK_SELLER_METRICS;
  const products = MOCK_PRODUCTS.filter((p) => p.seller_id === SELLER_ID);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-100">Seller Dashboard</h1>
          <p className="text-sm text-neutral-400 mt-0.5">TechGear Co. · {SELLER_ID}</p>
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
          <TabsTrigger value="ai" className="flex items-center gap-1.5">
            <BotMessageSquare className="h-3.5 w-3.5" />
            AI Assistant
          </TabsTrigger>
        </TabsList>

        {/* Orders Tab */}
        <TabsContent value="orders">
          <div className="space-y-3">
            {sellerOrders.length === 0 ? (
              <div className="text-center py-16 text-neutral-500">
                <Package className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p>No orders yet.</p>
              </div>
            ) : (
              sellerOrders.map((order) => {
                const nextState = NEXT_STATES[order.state];
                const actionLabel = ACTION_LABELS[order.state];

                return (
                  <Card key={order.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-mono text-neutral-400">{order.id}</span>
                            <OrderStatusBadge state={order.state} />
                          </div>
                          <p className="text-sm text-neutral-300">
                            {order.items.map((i) => i.product_name).join(", ")}
                          </p>
                          <div className="flex items-center gap-3 mt-2 text-xs text-neutral-500">
                            <span>{formatDate(order.created_at)}</span>
                            <span>{formatUsd(order.total_usd)}</span>
                            {order.tracking_number && (
                              <span className="font-mono">{order.carrier} · {order.tracking_number.slice(0, 12)}…</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {order.label_url && (
                            <a href={order.label_url} target="_blank" rel="noopener noreferrer">
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
          </div>
        </TabsContent>

        {/* Products Tab */}
        <TabsContent value="products">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map((p) => (
              <Card key={p.id}>
                <div className="relative h-32 rounded-t-xl overflow-hidden">
                  <Image src={p.image_url} alt={p.name} fill className="object-cover" />
                </div>
                <CardContent className="p-3">
                  <p className="font-medium text-sm text-neutral-100 truncate">{p.name}</p>
                  <div className="flex justify-between mt-1 text-sm">
                    <span className="text-neutral-400">{formatUsd(p.price_usd)}</span>
                    <span className="text-neutral-500">{p.stock} in stock</span>
                  </div>
                </CardContent>
              </Card>
            ))}
            <Card className="border-dashed flex items-center justify-center h-48 cursor-pointer hover:border-neutral-600 transition-colors">
              <div className="text-center text-neutral-600">
                <PlusCircle className="h-8 w-8 mx-auto mb-2" />
                <p className="text-sm">Add Product</p>
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* Payouts Tab */}
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
                          {payout.state.replace("_", " ")} — Order {payout.order_id}
                        </p>
                        <p className="text-xs text-neutral-500 mt-0.5">
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
                          className="text-xs text-neutral-500 hover:text-neutral-300 flex items-center justify-end gap-0.5"
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

        {/* Metrics Tab */}
        <TabsContent value="metrics">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-8 w-8 rounded-lg bg-neutral-800 flex items-center justify-center">
                      <Icon className={`h-4 w-4 ${color}`} />
                    </div>
                    <p className="text-sm text-neutral-400">{label}</p>
                  </div>
                  <p className="text-2xl font-bold text-neutral-100">{value}</p>
                  <p className="text-xs text-neutral-500 mt-1">{sub}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* AI Assistant Tab */}
        <TabsContent value="ai">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <AgentChat
                agentType="seller"
                context={{ sellerId: SELLER_ID }}
                agentName="Seller AI Assistant"
                placeholder="Ask about your orders, payouts, or disputes..."
                suggestions={[
                  "Show my pending orders",
                  "What are my metrics?",
                  "How much have I been paid?",
                  "Confirm label for order-008",
                ]}
              />
            </div>
            <div className="lg:col-span-1 space-y-4">
              <Card>
                <CardContent className="p-4 text-sm text-neutral-400 space-y-2">
                  <p className="font-medium text-neutral-300">What can I ask?</p>
                  <ul className="space-y-1.5 list-disc list-inside text-xs">
                    <li>View and filter your orders by status</li>
                    <li>Check payout history & pending amounts</li>
                    <li>Confirm label printed to unlock 15% payout</li>
                    <li>Respond to buyer disputes</li>
                    <li>View your performance metrics</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
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
