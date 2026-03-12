"use client";

import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import {
  ArrowLeft,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Coins,
  Bot,
  Wrench,
} from "lucide-react";
import { fetcher } from "@/lib/api-client";

const statusColors: Record<string, string> = {
  completed: "text-green-400 bg-green-500/10",
  failed: "text-red-400 bg-red-500/10",
  running: "text-yellow-400 bg-yellow-500/10",
  pending: "text-blue-400 bg-blue-500/10",
};

export default function RunDetailPage() {
  const { runId } = useParams<{ runId: string }>();
  const router = useRouter();
  const { data: run, isLoading } = useSWR(`/api/runs/${runId}`, fetcher);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!run || run.error) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Run not found</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <button
        onClick={() => router.push("/runs")}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        All Runs
      </button>

      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <div
          className={`px-3 py-1 rounded-lg text-sm font-medium ${statusColors[run.status] || ""}`}
        >
          {run.status === "completed" ? (
            <CheckCircle2 className="w-4 h-4 inline mr-1" />
          ) : run.status === "failed" ? (
            <XCircle className="w-4 h-4 inline mr-1" />
          ) : null}
          {run.status}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold mb-1 break-words">{run.task}</h1>
          <p className="text-xs text-muted-foreground">
            {new Date(run.createdAt).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Clock className="w-3 h-3" />
            Duration
          </div>
          <p className="text-sm font-medium">
            {run.durationMs ? `${(run.durationMs / 1000).toFixed(1)}s` : "—"}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Bot className="w-3 h-3" />
            Tokens
          </div>
          <p className="text-sm font-medium">
            {run.tokensUsed?.toLocaleString() || "—"}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Coins className="w-3 h-3" />
            Cost
          </div>
          <p className="text-sm font-medium">
            {run.estimatedCostUsd
              ? `$${Number(run.estimatedCostUsd).toFixed(4)}`
              : "—"}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Wrench className="w-3 h-3" />
            Tool Calls
          </div>
          <p className="text-sm font-medium">
            {run.toolCalls?.length || 0}
          </p>
        </div>
      </div>

      {/* Result */}
      {run.resultFull && (
        <div className="rounded-xl border border-border bg-card p-5 mb-4">
          <h3 className="text-sm font-medium mb-3">Result</h3>
          <div className="text-sm text-muted-foreground whitespace-pre-wrap bg-secondary/30 rounded-lg p-4 max-h-96 overflow-y-auto">
            {run.resultFull}
          </div>
        </div>
      )}

      {/* Error */}
      {run.errorMessage && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5 mb-4">
          <h3 className="text-sm font-medium text-red-400 mb-2">Error</h3>
          <p className="text-sm text-red-300/80 font-mono">
            {run.errorMessage}
          </p>
        </div>
      )}

      {/* Tool Calls */}
      {run.toolCalls?.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-medium mb-3">
            Tool Calls ({run.toolCalls.length})
          </h3>
          <div className="space-y-2">
            {run.toolCalls.map((tc: any, i: number) => (
              <div
                key={tc.id || i}
                className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-secondary/30"
              >
                <Wrench className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-medium font-mono">
                    {tc.name}
                  </span>
                  {tc.arguments && (
                    <pre className="text-[11px] text-muted-foreground mt-1 overflow-x-auto max-h-24">
                      {typeof tc.arguments === "string"
                        ? tc.arguments
                        : JSON.stringify(tc.arguments, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
