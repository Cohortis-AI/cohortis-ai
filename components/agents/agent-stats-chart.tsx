"use client";

import { useEffect, useRef } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/api-client";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { BarChart3, Clock, Coins, Zap } from "lucide-react";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
  Filler
);

export function AgentStatsChart({ agentId }: { agentId: string }) {
  const { data, isLoading } = useSWR(
    `/api/agents/${agentId}/stats`,
    fetcher
  );

  if (isLoading || !data) return null;

  const { dailyStats, recentRuns } = data;

  if (!dailyStats?.length && !recentRuns?.length) return null;

  // Build chart data
  const labels = (dailyStats || []).map((d: any) => {
    const date = new Date(d.day + "T00:00:00");
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  });

  const chartData = {
    labels,
    datasets: [
      {
        label: "Completed",
        data: (dailyStats || []).map((d: any) => d.completedRuns || 0),
        backgroundColor: "rgba(34, 197, 94, 0.6)",
        borderRadius: 4,
        barPercentage: 0.6,
      },
      {
        label: "Failed",
        data: (dailyStats || []).map((d: any) => d.failedRuns || 0),
        backgroundColor: "rgba(239, 68, 68, 0.6)",
        borderRadius: 4,
        barPercentage: 0.6,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: "top" as const,
        align: "end" as const,
        labels: {
          color: "rgb(113, 113, 122)",
          font: { size: 10 },
          boxWidth: 8,
          boxHeight: 8,
          useBorderRadius: true,
          borderRadius: 2,
        },
      },
      tooltip: {
        backgroundColor: "rgb(24, 24, 27)",
        titleColor: "rgb(244, 244, 245)",
        bodyColor: "rgb(161, 161, 170)",
        borderColor: "rgb(39, 39, 42)",
        borderWidth: 1,
        padding: 8,
        titleFont: { size: 11 },
        bodyFont: { size: 11 },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          color: "rgb(113, 113, 122)",
          font: { size: 10 },
        },
      },
      y: {
        beginAtZero: true,
        grid: {
          color: "rgba(39, 39, 42, 0.5)",
        },
        ticks: {
          color: "rgb(113, 113, 122)",
          font: { size: 10 },
          stepSize: 1,
        },
      },
    },
  };

  // Compute summary stats from recent runs
  const completed = (recentRuns || []).filter(
    (r: any) => r.status === "completed"
  );
  const avgDuration =
    completed.length > 0
      ? completed.reduce((sum: number, r: any) => sum + (r.durationMs || 0), 0) /
        completed.length
      : 0;
  const totalTokens = (recentRuns || []).reduce(
    (sum: number, r: any) => sum + (r.tokensUsed || 0),
    0
  );

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-xs font-medium flex items-center gap-2">
          <BarChart3 className="w-3.5 h-3.5 text-primary" />
          Performance (last 14 days)
        </h3>
      </div>

      {/* Mini stats */}
      <div className="grid grid-cols-3 gap-px bg-border">
        <div className="bg-card px-3 py-2.5">
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-0.5">
            <Zap className="w-2.5 h-2.5" />
            Last 10 runs
          </div>
          <p className="text-xs font-medium">
            {completed.length}/{(recentRuns || []).length} success
          </p>
        </div>
        <div className="bg-card px-3 py-2.5">
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-0.5">
            <Clock className="w-2.5 h-2.5" />
            Avg Duration
          </div>
          <p className="text-xs font-medium">
            {avgDuration > 0 ? `${(avgDuration / 1000).toFixed(1)}s` : "—"}
          </p>
        </div>
        <div className="bg-card px-3 py-2.5">
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-0.5">
            <Coins className="w-2.5 h-2.5" />
            Tokens (last 10)
          </div>
          <p className="text-xs font-medium">
            {totalTokens > 0 ? totalTokens.toLocaleString() : "—"}
          </p>
        </div>
      </div>

      {/* Chart */}
      {dailyStats?.length > 0 && (
        <div className="p-4" style={{ height: 180 }}>
          <Bar data={chartData} options={chartOptions} />
        </div>
      )}
    </div>
  );
}
