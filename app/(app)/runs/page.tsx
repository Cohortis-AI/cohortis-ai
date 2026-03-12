"use client";

import { useState, useCallback } from "react";
import useSWR from "swr";
import Link from "next/link";
import {
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Download,
  ChevronDown,
} from "lucide-react";
import { fetcher, apiFetch } from "@/lib/api-client";

const PAGE_SIZE = 30;

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
  const [allRuns, setAllRuns] = useState<any[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exporting, setExporting] = useState(false);

  const { isLoading } = useSWR(
    `/api/runs?limit=${PAGE_SIZE}&offset=0`,
    fetcher,
    {
      onSuccess: (data) => {
        if (allRuns.length === 0) {
          setAllRuns(Array.isArray(data) ? data : []);
          setHasMore((data?.length || 0) >= PAGE_SIZE);
        }
      },
    }
  );

  const loadMore = useCallback(async () => {
    setLoadingMore(true);
    try {
      const nextOffset = offset + PAGE_SIZE;
      const data = await fetcher(
        `/api/runs?limit=${PAGE_SIZE}&offset=${nextOffset}`
      );
      const newRuns = Array.isArray(data) ? data : [];
      setAllRuns((prev) => [...prev, ...newRuns]);
      setOffset(nextOffset);
      setHasMore(newRuns.length >= PAGE_SIZE);
    } catch {
      // ignore
    } finally {
      setLoadingMore(false);
    }
  }, [offset]);

  const handleExport = async (format: "csv" | "json") => {
    setExporting(true);
    try {
      const res = await apiFetch(`/api/runs?format=${format}&limit=1000`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cohortis-runs-${new Date().toISOString().split("T")[0]}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            Runs
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Execution history across all agents
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleExport("csv")}
            disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <Download className="w-3 h-3" />
            CSV
          </button>
          <button
            onClick={() => handleExport("json")}
            disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <Download className="w-3 h-3" />
            JSON
          </button>
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
      ) : !allRuns.length ? (
        <div className="text-center py-16">
          <Activity className="w-12 h-12 mx-auto text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-medium mb-2">No runs yet</h3>
          <p className="text-sm text-muted-foreground">
            Execute a task on any agent to see runs here
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-1">
            {allRuns.map((run: any) => (
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
                    <span>{run.tokensUsed.toLocaleString()} tok</span>
                  )}
                  {run.estimatedCostUsd && (
                    <span>${Number(run.estimatedCostUsd).toFixed(4)}</span>
                  )}
                </div>
              </Link>
            ))}
          </div>

          {/* Load More */}
          {hasMore && (
            <div className="flex justify-center mt-4">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
              >
                {loadingMore ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
                Load More
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
