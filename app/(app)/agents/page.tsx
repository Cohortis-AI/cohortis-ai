"use client";

import useSWR from "swr";
import Link from "next/link";
import {
  Bot,
  Plus,
  MoreVertical,
  Pause,
  Play,
  CheckCircle2,
  XCircle,
} from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const typeColors: Record<string, string> = {
  general: "#7C3AED",
  email: "#F59E0B",
  calendar: "#00D4FF",
  documents: "#9D7CD8",
  data: "#22C55E",
  social: "#F97316",
  custom: "#6366F1",
};

export default function AgentsPage() {
  const { data: agents, isLoading } = useSWR("/api/agents", fetcher);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Agents</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create and manage your AI agents
          </p>
        </div>
        <Link
          href="/agents/new"
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Agent
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-border bg-card p-5 h-40 animate-pulse"
            />
          ))}
        </div>
      ) : !agents?.length ? (
        <div className="text-center py-16">
          <Bot className="w-12 h-12 mx-auto text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-medium mb-2">No agents yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Create your first agent to get started
          </p>
          <Link
            href="/agents/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Create Agent
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent: any) => {
            const color = typeColors[agent.type] || typeColors.general;
            const completed = agent.totalTasksCompleted || 0;
            const failed = agent.totalTasksFailed || 0;

            return (
              <Link
                key={agent.id}
                href={`/agents/${agent.id}`}
                className="rounded-xl border border-border bg-card p-5 hover:border-primary/30 transition-colors group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: `${color}15` }}
                    >
                      <Bot className="w-5 h-5" style={{ color }} />
                    </div>
                    <div>
                      <h3 className="font-medium text-sm group-hover:text-primary transition-colors">
                        {agent.name}
                      </h3>
                      {agent.role && (
                        <p className="text-xs text-muted-foreground">
                          {agent.role}
                        </p>
                      )}
                    </div>
                  </div>
                  <span
                    className={`w-2 h-2 rounded-full mt-1.5 ${
                      agent.isActive ? "bg-green-500" : "bg-red-500"
                    }`}
                  />
                </div>

                {agent.description && (
                  <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                    {agent.description}
                  </p>
                )}

                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-green-500" />
                    {completed}
                  </span>
                  <span className="flex items-center gap-1">
                    <XCircle className="w-3 h-3 text-red-500" />
                    {failed}
                  </span>
                  <span className="ml-auto text-[10px] uppercase tracking-wider opacity-60">
                    {agent.type}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
