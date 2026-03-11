"use client";

import useSWR from "swr";
import {
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  DollarSign,
  Bot,
  Zap,
} from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function KpiCard({
  title,
  value,
  icon: Icon,
  subtitle,
  color,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  subtitle?: string;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-muted-foreground">{title}</span>
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${color}15` }}
        >
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
      </div>
      <p className="text-2xl font-semibold">{value}</p>
      {subtitle && (
        <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { data: stats, isLoading } = useSWR("/api/dashboard", fetcher);

  if (isLoading) {
    return (
      <div className="p-8">
        <h1 className="text-xl font-semibold mb-6">Dashboard</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-border bg-card p-5 h-28 animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  const successRate =
    stats?.totalRuns > 0
      ? Math.round(((stats.successRuns || 0) / stats.totalRuns) * 100)
      : 0;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <span className="text-xs text-muted-foreground">Last 30 days</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiCard
          title="Total Runs"
          value={stats?.totalRuns || 0}
          icon={Activity}
          color="#7C3AED"
        />
        <KpiCard
          title="Success Rate"
          value={`${successRate}%`}
          icon={CheckCircle2}
          subtitle={`${stats?.successRuns || 0} completed, ${stats?.failedRuns || 0} failed`}
          color="#22C55E"
        />
        <KpiCard
          title="Avg Duration"
          value={
            stats?.avgDurationMs
              ? `${(stats.avgDurationMs / 1000).toFixed(1)}s`
              : "—"
          }
          icon={Clock}
          color="#F59E0B"
        />
        <KpiCard
          title="Total Cost"
          value={
            stats?.totalCostUsd
              ? `$${Number(stats.totalCostUsd).toFixed(2)}`
              : "$0.00"
          }
          icon={DollarSign}
          subtitle={`${stats?.totalAgents || 0} agents active`}
          color="#3B82F6"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
            <Bot className="w-4 h-4 text-primary" />
            Quick Actions
          </h3>
          <div className="space-y-2">
            <a
              href="/agents/new"
              className="flex items-center gap-3 px-4 py-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors text-sm"
            >
              <Bot className="w-4 h-4 text-primary" />
              Create a new agent
            </a>
            <a
              href="/hierarchy"
              className="flex items-center gap-3 px-4 py-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors text-sm"
            >
              <Zap className="w-4 h-4 text-primary" />
              Build your agent hierarchy
            </a>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            Recent Activity
          </h3>
          <p className="text-sm text-muted-foreground">
            Run history will appear here once agents start executing tasks.
          </p>
        </div>
      </div>
    </div>
  );
}
