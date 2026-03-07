"use client";

import { RequireRole } from "@/components/guards/RequireRole";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line,
} from "recharts";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  BarChart3, DollarSign, Shield, AlertTriangle, Clock, CheckCircle, XCircle, BotMessageSquare
} from "lucide-react";
import { MOCK_ANALYTICS, MOCK_SELLERS, MOCK_WEBHOOK_EVENTS } from "@/lib/mock-data";
import { formatUsd, formatDateTime } from "@/lib/utils";
import AgentChat from "@/components/chat/AgentChat";

function AdminDashboardContent() {
  const analytics = MOCK_ANALYTICS;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-100">Admin Dashboard</h1>
          <p className="text-sm text-neutral-400 mt-0.5">Platform overview · FlowState Demo</p>
        </div>
      </div>

      <Tabs defaultValue="analytics">
        <TabsList className="mb-6">
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="sellers">Sellers</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
          <TabsTrigger value="ai" className="flex items-center gap-1.5">
            <BotMessageSquare className="h-3.5 w-3.5" />
            AI Analyst
          </TabsTrigger>
        </TabsList>

        {/* Analytics Tab */}
        <TabsContent value="analytics">
          <div className="space-y-6">
            {/* KPI cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-8 w-8 rounded-lg bg-neutral-800 flex items-center justify-center">
                        <Icon className={`h-4 w-4 ${color}`} />
                      </div>
                      <p className="text-sm text-neutral-400">{label}</p>
                    </div>
                    <p className="text-2xl font-bold text-neutral-100">{value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                        tickFormatter={(v) => v.slice(5)}
                      />
                      <YAxis tick={{ fill: "#737373", fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#171717", border: "1px solid #262626", borderRadius: 8 }}
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
                        tickFormatter={(v) => v.slice(5)}
                      />
                      <YAxis tick={{ fill: "#737373", fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#171717", border: "1px solid #262626", borderRadius: 8 }}
                        labelStyle={{ color: "#a3a3a3" }}
                        itemStyle={{ color: "#34d399" }}
                        formatter={(v) => formatUsd(Number(v))}
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
              <CardContent className="p-5 flex items-center gap-3">
                <Clock className="h-4 w-4 text-neutral-400" />
                <span className="text-sm text-neutral-400">
                  Avg dispute resolution: <span className="text-neutral-200 font-semibold">{analytics.avg_resolution_hours.toFixed(1)} hours</span>
                </span>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Sellers Tab */}
        <TabsContent value="sellers">
          <div className="space-y-3">
            {MOCK_SELLERS.map((seller) => (
              <Card key={seller.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-neutral-100">{seller.business_name}</p>
                        <Badge variant={seller.status === "active" ? "success" : seller.status === "suspended" ? "destructive" : "secondary"}>
                          {seller.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-neutral-400">{seller.email}</p>
                      <p className="text-xs text-neutral-500 font-mono mt-0.5">{seller.wallet_address}</p>
                    </div>
                    <div className="text-right text-sm">
                      <p className="text-neutral-300">
                        {seller.address.city}, {seller.address.state}
                      </p>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        Since {new Date(seller.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <Separator className="my-3" />
                  <div className="flex items-center gap-4 text-xs text-neutral-500">
                    <span>Immediate: {(seller.payout_config.immediate_bps / 100).toFixed(0)}%</span>
                    <span>Milestone: {(seller.payout_config.milestone_bps / 100).toFixed(0)}%</span>
                    <span>Holdback: {(seller.payout_config.holdback_bps / 100).toFixed(0)}%</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Webhooks Tab */}
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
                          <CheckCircle className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                        )}
                        <div>
                          <p className="text-sm font-medium text-neutral-200">{event.event_type}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge variant="secondary" className="text-xs">{event.source}</Badge>
                            {event.order_id && (
                              <span className="text-xs text-neutral-500">{event.order_id}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right text-xs text-neutral-500 shrink-0">
                        <p>{formatDateTime(event.timestamp)}</p>
                        {event.http_status && (
                          <p className={event.http_status === 200 ? "text-emerald-500" : "text-red-500"}>
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

        {/* AI Analyst Tab */}
        <TabsContent value="ai">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <AgentChat
                agentType="admin"
                agentName="FlowState Admin AI"
                placeholder="Ask about platform metrics, sellers, or webhooks..."
                suggestions={[
                  "How is the platform performing?",
                  "Are there any flagged sellers?",
                  "Show me gas costs breakdown",
                  "Any failed webhook events?",
                ]}
              />
            </div>
            <div className="lg:col-span-1 space-y-4">
              <Card>
                <CardContent className="p-4 text-sm text-neutral-400 space-y-2">
                  <p className="font-medium text-neutral-300">What can I ask?</p>
                  <ul className="space-y-1.5 list-disc list-inside text-xs">
                    <li>Platform-wide analytics & dispute rates</li>
                    <li>Seller performance & flagged accounts</li>
                    <li>Webhook health & failed events</li>
                    <li>Gas spend breakdown by transaction type</li>
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

export default function AdminDashboardPage() {
  return (
    <RequireRole roles={["admin"]}>
      <AdminDashboardContent />
    </RequireRole>
  );
}
