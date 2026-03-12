"use client";

import useSWR from "swr";
import Link from "next/link";
import {
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  DollarSign,
  Bot,
  Zap,
  MessageSquare,
  ArrowRight,
} from "lucide-react";
import { fetcher } from "@/lib/api-client";

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

const statusColors: Record<string, string> = {
  completed: "text-green-400 bg-green-500/10",
  failed: "text-red-400 bg-red-500/10",
  running: "text-yellow-400 bg-yellow-500/10",
  pending: "text-blue-400 bg-blue-500/10",
};

const typeColors: Record<string, string> = {
  general: "#7C3AED",
  email: "#F59E0B",
  calendar: "#00D4FF",
  documents: "#9D7CD8",
  data: "#22C55E",
  social: "#F97316",
  custom: "#6366F1",
};

function formatDuration(ms: number | null) {
  if (!ms) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default function DashboardPage() {
  const { data: stats, isLoading } = useSWR("/api/dashboard", fetcher);
  const { data: recentRuns } = useSWR("/api/runs?limit=5", fetcher);
  const { data: agents } = useSWR("/api/agents", fetcher);

  if (isLoading) {
    return (
      <div className="p-6">
        <h1 className="text-lg font-semibold mb-6">Dashboard</h1>
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

  const agentList = Array.isArray(agents) ? agents : [];
  const runsList = Array.isArray(recentRuns) ? recentRuns : [];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-semibold">Dashboard</h1>
        <span className="text-xs text-muted-foreground">Last 30 days</span>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Recent Activity */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              Recent Activity
            </h3>
            <Link
              href="/runs"
              className="text-[11px] text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
            >
              View all
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {runsList.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No runs yet. Execute a task on any agent to get started.
            </p>
          ) : (
            <div className="space-y-1.5">
              {runsList.slice(0, 5).map((run: any) => (
                <Link
                  key={run.id}
                  href={`/runs/${run.id}`}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-secondary/50 transition-colors"
                >
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${statusColors[run.status] || ""}`}
                  >
                    {run.status}
                  </span>
                  <p className="text-xs flex-1 truncate">{run.task}</p>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {formatDuration(run.durationMs)}
                  </span>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {new Date(run.createdAt).toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            Quick Actions
          </h3>
          <div className="space-y-2">
            <Link
              href="/agents/new"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors text-sm"
            >
              <Bot className="w-4 h-4 text-primary" />
              Create a new agent
            </Link>
            <Link
              href="/team-chat"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors text-sm"
            >
              <MessageSquare className="w-4 h-4 text-primary" />
              Open Team Chat
            </Link>
            <Link
              href="/hierarchy"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors text-sm"
            >
              <Activity className="w-4 h-4 text-primary" />
              Build hierarchy
            </Link>
          </div>
        </div>
      </div>

      {/* Agent Performance Overview */}
      {agentList.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Bot className="w-4 h-4 text-primary" />
              Agent Performance
            </h3>
            <Link
              href="/agents"
              className="text-[11px] text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
            >
              View all
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {agentList.map((agent: any) => {
              const completed = agent.totalTasksCompleted || 0;
              const failed = agent.totalTasksFailed || 0;
              const total = completed + failed;
              const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
              const color = typeColors[agent.type] || "#7C3AED";
              const barWidth = total > 0 ? (completed / total) * 100 : 0;

              return (
                <Link
                  key={agent.id}
                  href={`/agents/${agent.id}`}
                  className="p-3 rounded-lg border border-border/50 hover:border-primary/20 transition-colors"
                >
                  <div className="flex items-center gap-2.5 mb-2">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${color}15` }}
                    >
                      <Bot className="w-3.5 h-3.5" style={{ color }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate">
                        {agent.name}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {total} runs &middot; {rate}% success
                      </p>
                    </div>
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${agent.isActive ? "bg-green-500" : "bg-zinc-500"}`}
                    />
                  </div>

                  {/* Mini progress bar */}
                  <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${barWidth}%`,
                        backgroundColor: color,
                      }}
                    />
                  </div>

                  <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-0.5">
                      <CheckCircle2 className="w-2.5 h-2.5 text-green-500" />
                      {completed}
                    </span>
                    <span className="flex items-center gap-0.5">
                      <XCircle className="w-2.5 h-2.5 text-red-500" />
                      {failed}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
