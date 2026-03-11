"use client";

import useSWR from "swr";
import Link from "next/link";
import { Activity, CheckCircle2, XCircle, Clock, Loader2 } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function formatDuration(ms: number | null) {
  if (!ms) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const statusColors: Record<string, string> = {
  completed: "text-green-400 bg-green-500/10",
  failed: "text-red-400 bg-red-500/10",
  running: "text-yellow-400 bg-yellow-500/10",
  pending: "text-blue-400 bg-blue-500/10",
};

export default function RunsPage() {
  const { data: runs, isLoading } = useSWR("/api/runs", fetcher);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            Runs
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Execution history across all agents
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-16 rounded-xl border border-border bg-card animate-pulse"
            />
          ))}
        </div>
      ) : !runs?.length ? (
        <div className="text-center py-16">
          <Activity className="w-12 h-12 mx-auto text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-medium mb-2">No runs yet</h3>
          <p className="text-sm text-muted-foreground">
            Execute a task on any agent to see runs here
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {runs.map((run: any) => (
            <Link
              key={run.id}
              href={`/runs/${run.id}`}
              className="flex items-center gap-4 px-4 py-3 rounded-xl border border-border bg-card hover:border-primary/20 transition-colors"
            >
              <span
                className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[run.status] || ""}`}
              >
                {run.status}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{run.task}</p>
                <p className="text-[11px] text-muted-foreground">
                  {formatDate(run.createdAt)}
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatDuration(run.durationMs)}
                </span>
                {run.tokensUsed && (
                  <span>{run.tokensUsed.toLocaleString()} tokens</span>
                )}
                {run.estimatedCostUsd && (
                  <span>${Number(run.estimatedCostUsd).toFixed(4)}</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
