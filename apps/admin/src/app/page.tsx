"use client";

import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Bookmark,
  Database,
  Layers,
  Newspaper,
  Plug,
  RefreshCw,
  Send,
  Sparkles,
  Tag,
  Users,
} from "lucide-react";
import Link from "next/link";
import type { AdminDashboardStats as Stats, DailyTrendPoint } from "@attune/types";
import { api } from "@/lib/api";
import { AccessDenied, usePermissions } from "@/lib/permissions";
import { Badge, Button, Card, PageHeader } from "@/components/ui";
import { cn } from "@/lib/utils";

const SOURCE_COLORS: Record<string, string> = {
  RSS: "#f97316",
  NEWSAPI: "#3b82f6",
  DEVTO: "#10b981",
  SUBSTACK: "#ec4899",
  YOUTUBE: "#ef4444",
  REDDIT: "#ff4500",
  CUSTOM: "#8b5cf6",
};

const INTERACTION_COLORS: Record<string, string> = {
  read: "#3b82f6",
  bookmark: "#10b981",
  like: "#f43f5e",
  share: "#8b5cf6",
  click: "#f59e0b",
  dismiss: "#6b7280",
};

export default function DashboardPage() {
  const { can, loading: permsLoading } = usePermissions();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchStats = () => {
    if (!can("dashboard", "read")) return;
    setLoading(true);
    api.stats
      .get()
      .then((data) => {
        setStats(data);
        setError(false);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchStats();
  }, [can]);

  if (!permsLoading && !can("dashboard", "read")) {
    return <AccessDenied feature="Dashboard" />;
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-destructive/20 bg-destructive/10 p-6 text-destructive">
        <p className="font-semibold">Could not load dashboard statistics</p>
        <p className="mt-1 text-sm opacity-80">Is the API running on port 3000?</p>
        <Button variant="outline" size="sm" onClick={fetchStats} className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Loading dashboard metrics…
      </div>
    );
  }

  const totalInteractions = (stats.interactionsByType ?? []).reduce((acc, curr) => acc + curr.count, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title="Dashboard"
          subtitle="Platform telemetry, 7-day trends, and ingestion health"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={fetchStats}
          disabled={loading}
          className="self-start gap-1.5 sm:self-auto"
        >
          <RefreshCw size={14} className={cn(loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Primary KPI Metric Cards with 7-Day Sparkline Trends */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard
          label="Total Users"
          value={stats.usersTotal.toLocaleString()}
          sub={`+${stats.usersNewToday} new today`}
          Icon={Users}
          trend={stats.usersTrend}
          color="#3b82f6"
        />
        <StatCard
          label="Total Items"
          value={stats.itemsTotal.toLocaleString()}
          sub={`+${stats.itemsToday} ingested today`}
          Icon={Newspaper}
          trend={stats.itemsTrend}
          color="#10b981"
        />
        <StatCard
          label="Interactions"
          value={stats.interactionsToday.toLocaleString()}
          sub="Last 24 hours"
          Icon={Activity}
          trend={stats.interactionsTrend}
          color="#8b5cf6"
        />
        <StatCard
          label="Notifications"
          value={stats.notifSentToday.toLocaleString()}
          sub="Last 24 hours"
          Icon={Send}
          trend={stats.notifTrend}
          color="#f59e0b"
        />
        <StatCard
          label="Feed Health"
          value={stats.failingSources.length === 0 ? "Healthy" : `${stats.failingSources.length} failing`}
          sub={stats.failingSources.length === 0 ? "All sources syncing" : "Action required"}
          warn={stats.failingSources.length > 0}
          Icon={AlertTriangle}
        />
      </div>

      {/* Row 1: Content Ingestion & Popular Topics */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Ingestion Throughput by Source Type */}
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
                Ingestion Volume by Source Type
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">Total articles & media items per connector</p>
            </div>
            {can("sources", "read") && (
              <Link
                href="/sources"
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
              >
                Sources <ArrowUpRight size={13} />
              </Link>
            )}
          </div>

          {(!stats.itemsBySourceType || stats.itemsBySourceType.length === 0) ? (
            <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
              No source distribution recorded yet.
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.itemsBySourceType} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.15} />
                  <XAxis type="number" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="type"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    width={80}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--card)",
                      borderColor: "var(--border)",
                      borderRadius: "0.75rem",
                      color: "var(--card-foreground)",
                      boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)",
                    }}
                  />
                  <Bar dataKey="count" name="Items Ingested" radius={[0, 6, 6, 0]}>
                    {stats.itemsBySourceType.map((entry) => (
                      <Cell
                        key={entry.type}
                        fill={SOURCE_COLORS[entry.type.toUpperCase()] ?? "#3b82f6"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        {/* Top Topics (Last 7 Days) */}
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
                Top Topics (Last 7 Days)
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">Most active content categories</p>
            </div>
            {can("topics", "read") && (
              <Link
                href="/topics"
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
              >
                Topics <ArrowUpRight size={13} />
              </Link>
            )}
          </div>
          {stats.topTopics.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
              No tagged items recorded yet.
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.topTopics}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.15} />
                  <XAxis dataKey="key" fontSize={12} tickLine={false} />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--card)",
                      borderColor: "var(--border)",
                      borderRadius: "0.75rem",
                      color: "var(--card-foreground)",
                      boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)",
                    }}
                  />
                  <Bar dataKey="n" name="Items" fill="#10b981" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      {/* Row 2: User Engagement Breakdown & System Operations / Quick Actions */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* User Engagement Breakdown */}
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
                User Engagement Breakdown
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">Distribution across user action types</p>
            </div>
            <Badge variant="outline" className="font-mono text-xs">
              {totalInteractions.toLocaleString()} total actions
            </Badge>
          </div>

          {(!stats.interactionsByType || stats.interactionsByType.length === 0) ? (
            <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
              No interactions recorded yet.
            </div>
          ) : (
            <div className="space-y-4 py-2">
              {stats.interactionsByType.map((item) => {
                const pct = totalInteractions > 0 ? Math.round((item.count / totalInteractions) * 100) : 0;
                const barColor = INTERACTION_COLORS[item.type.toLowerCase()] ?? "#3b82f6";

                return (
                  <div key={item.type} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium capitalize text-foreground">{item.type}</span>
                      <span className="text-muted-foreground">
                        <strong className="text-foreground">{item.count.toLocaleString()}</strong> ({pct}%)
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: barColor }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Infrastructure & Operational Health */}
        <div className="flex flex-col gap-6">
          {/* Failing Sources Alert Box */}
          <Card className="p-6 flex-1">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
                Feed Status & Ingestion Health
              </h2>
              {can("sources", "read") && (
                <Link
                  href="/sources"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                >
                  Manage sources <ArrowUpRight size={13} />
                </Link>
              )}
            </div>

            {stats.failingSources.length === 0 ? (
              <div className="flex h-36 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-emerald-500/30 bg-emerald-500/5 p-4">
                <Badge variant="success">All sources healthy</Badge>
                <p className="text-xs text-muted-foreground text-center">
                  Zero feed connector errors across all active pipelines.
                </p>
              </div>
            ) : (
              <div className="max-h-44 space-y-2 overflow-y-auto pr-1">
                {stats.failingSources.map((s) => (
                  <div
                    key={s.id}
                    className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs"
                  >
                    <div className="flex items-center justify-between font-medium">
                      <span>{s.name}</span>
                      <Badge variant="destructive">failing</Badge>
                    </div>
                    <p className="mt-1 truncate font-mono text-muted-foreground">{s.error}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Quick Operations Console Navigation */}
          <Card className="p-5">
            <div className="mb-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Infrastructure Consoles
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Link
                href="/cache"
                className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-border bg-muted/30 p-3 text-center transition-all hover:bg-muted/70 hover:shadow-sm"
              >
                <Database size={18} className="text-amber-500" />
                <span className="text-xs font-medium">Cache</span>
              </Link>
              <Link
                href="/jobs"
                className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-border bg-muted/30 p-3 text-center transition-all hover:bg-muted/70 hover:shadow-sm"
              >
                <Layers size={18} className="text-indigo-500" />
                <span className="text-xs font-medium">Queues</span>
              </Link>
              <Link
                href="/sources"
                className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-border bg-muted/30 p-3 text-center transition-all hover:bg-muted/70 hover:shadow-sm"
              >
                <Plug size={18} className="text-emerald-500" />
                <span className="text-xs font-medium">Sources</span>
              </Link>
              <Link
                href="/topics"
                className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-border bg-muted/30 p-3 text-center transition-all hover:bg-muted/70 hover:shadow-sm"
              >
                <Tag size={18} className="text-blue-500" />
                <span className="text-xs font-medium">Topics</span>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  Icon,
  warn,
  trend,
  color = "#3b82f6",
}: {
  label: string;
  value: string | number;
  sub?: string;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
  warn?: boolean;
  trend?: DailyTrendPoint[];
  color?: string;
}) {
  const gradientId = `sparkline-${label.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <Card className="flex flex-col justify-between p-5 transition-all hover:shadow-md">
      <div>
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </span>
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-xl",
              warn
                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                : "bg-primary/10 text-primary",
            )}
          >
            <Icon size={15} />
          </div>
        </div>
        <div
          className={cn(
            "mt-2 text-2xl font-bold tracking-tight",
            warn ? "text-amber-600 dark:text-amber-400" : "text-foreground",
          )}
        >
          {value}
        </div>
        {sub ? <div className="mt-1 text-xs text-muted-foreground">{sub}</div> : null}
      </div>

      {trend && trend.length > 0 ? (
        <div className="mt-4 pt-2 border-t border-border/50">
          <div className="h-9 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={color} stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload as DailyTrendPoint;
                      return (
                        <div className="rounded-lg border border-border bg-popover px-2 py-1 text-[11px] shadow-sm">
                          <span className="text-muted-foreground font-mono">{data.date}: </span>
                          <span className="font-semibold text-foreground">{data.count}</span>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke={color}
                  strokeWidth={1.8}
                  fill={`url(#${gradientId})`}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground/60 px-0.5 mt-0.5">
            <span>7d ago</span>
            <span>Today</span>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
