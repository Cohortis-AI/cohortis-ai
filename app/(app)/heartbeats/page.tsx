"use client";

import { useState } from "react";
import useSWR, { mutate } from "swr";
import { toast } from "sonner";
import {
  HeartPulse,
  Plus,
  Loader2,
  Trash2,
  Play,
  Pause,
  CheckCircle2,
  XCircle,
  Clock,
  Bot,
  X,
  Zap,
} from "lucide-react";
import { fetcher, apiFetch } from "@/lib/api-client";

interface Heartbeat {
  id: string;
  agentId: string;
  task: string;
  frequency: string;
  isEnabled: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  totalRuns: number;
  lastStatus: string | null;
  lastResult: string | null;
  createdAt: string;
}

interface AgentBasic {
  id: string;
  name: string;
  type: string | null;
  isActive: boolean | null;
}

const frequencyLabels: Record<string, string> = {
  "5m": "Every 5 minutes",
  "15m": "Every 15 minutes",
  "30m": "Every 30 minutes",
  "1h": "Every hour",
  "4h": "Every 4 hours",
  "12h": "Every 12 hours",
  "24h": "Every 24 hours",
};

function formatNextRun(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  const diff = d.getTime() - Date.now();
  if (diff < 0) return "Due now";
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `in ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `in ${hours}h`;
  return `in ${Math.floor(hours / 24)}d`;
}

export default function HeartbeatsPage() {
  const { data: heartbeats = [], isLoading } = useSWR<Heartbeat[]>(
    "/api/heartbeats",
    fetcher,
    { refreshInterval: 10000 }
  );
  const { data: agents = [] } = useSWR<AgentBasic[]>("/api/agents", fetcher);

  const [createOpen, setCreateOpen] = useState(false);

  const enabledCount = heartbeats.filter((h) => h.isEnabled).length;
  const totalRuns = heartbeats.reduce((acc, h) => acc + (h.totalRuns || 0), 0);

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Heartbeats</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Scheduled agent wake-ups — agents check for work autonomously
          </p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Heartbeat
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-green-400/10 flex items-center justify-center">
            <HeartPulse className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <div className="text-2xl font-semibold">{enabledCount}</div>
            <div className="text-sm text-muted-foreground">Active</div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Zap className="w-5 h-5 text-primary" />
          </div>
          <div>
            <div className="text-2xl font-semibold">{totalRuns}</div>
            <div className="text-sm text-muted-foreground">Total Runs</div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-cyan-400/10 flex items-center justify-center">
            <Clock className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <div className="text-2xl font-semibold">{heartbeats.length}</div>
            <div className="text-sm text-muted-foreground">Total</div>
          </div>
        </div>
      </div>

      {/* Heartbeats list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : heartbeats.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <HeartPulse className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-1">
            No heartbeats yet
          </h3>
          <p className="text-muted-foreground mb-4">
            Schedule agents to wake up periodically and check for work
          </p>
          <button
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Create Heartbeat
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {heartbeats.map((hb) => {
            const agent = agents.find((a) => a.id === hb.agentId);
            return (
              <HeartbeatCard
                key={hb.id}
                heartbeat={hb}
                agentName={agent?.name || "Unknown"}
              />
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      {createOpen && (
        <CreateHeartbeatDialog
          agents={agents}
          onClose={() => setCreateOpen(false)}
        />
      )}
    </div>
  );
}

// ─── Heartbeat Card ───

function HeartbeatCard({
  heartbeat,
  agentName,
}: {
  heartbeat: Heartbeat;
  agentName: string;
}) {
  const handleToggle = async () => {
    await apiFetch(`/api/heartbeats/${heartbeat.id}`, {
      method: "PATCH",
      body: JSON.stringify({ isEnabled: !heartbeat.isEnabled }),
    });
    mutate("/api/heartbeats");
  };

  const handleDelete = async () => {
    if (!confirm("Delete this heartbeat?")) return;
    await apiFetch(`/api/heartbeats/${heartbeat.id}`, { method: "DELETE" });
    mutate("/api/heartbeats");
    toast.success("Heartbeat deleted");
  };

  return (
    <div
      className={`rounded-xl border border-border bg-card p-4 flex items-center gap-4 ${
        !heartbeat.isEnabled ? "opacity-50" : ""
      }`}
    >
      {/* Status indicator */}
      <div
        className={`w-3 h-3 rounded-full shrink-0 ${
          heartbeat.isEnabled ? "bg-green-400 animate-pulse" : "bg-muted-foreground/30"
        }`}
      />

      {/* Agent + task */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
            <Bot className="w-3 h-3" />
            {agentName}
          </span>
          <span className="text-xs text-muted-foreground">
            {frequencyLabels[heartbeat.frequency] || heartbeat.frequency}
          </span>
        </div>
        <p className="text-sm text-foreground mt-1 truncate">{heartbeat.task}</p>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 shrink-0">
        {/* Last status */}
        {heartbeat.lastStatus && (
          <div className="flex items-center gap-1 text-xs">
            {heartbeat.lastStatus === "completed" ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
            ) : (
              <XCircle className="w-3.5 h-3.5 text-red-400" />
            )}
            <span className="text-muted-foreground">
              {heartbeat.totalRuns} runs
            </span>
          </div>
        )}

        {/* Next run */}
        <span className="text-xs text-muted-foreground min-w-[60px] text-right">
          {heartbeat.isEnabled
            ? formatNextRun(heartbeat.nextRunAt)
            : "Paused"}
        </span>

        {/* Toggle */}
        <button
          onClick={handleToggle}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          title={heartbeat.isEnabled ? "Pause" : "Resume"}
        >
          {heartbeat.isEnabled ? (
            <Pause className="w-4 h-4" />
          ) : (
            <Play className="w-4 h-4" />
          )}
        </button>

        {/* Delete */}
        <button
          onClick={handleDelete}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Create Dialog ───

function CreateHeartbeatDialog({
  agents,
  onClose,
}: {
  agents: AgentBasic[];
  onClose: () => void;
}) {
  const [agentId, setAgentId] = useState("");
  const [task, setTask] = useState("");
  const [frequency, setFrequency] = useState("1h");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!agentId || !task.trim()) return;
    setSaving(true);
    try {
      const res = await apiFetch("/api/heartbeats", {
        method: "POST",
        body: JSON.stringify({
          agentId,
          task: task.trim(),
          frequency,
        }),
      });
      if (!res.ok) throw new Error();
      mutate("/api/heartbeats");
      toast.success("Heartbeat created");
      onClose();
    } catch {
      toast.error("Failed to create heartbeat");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold">Create Heartbeat</h2>
          <button
            onClick={onClose}
            className="p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Agent</label>
            <select
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">Select agent...</option>
              {agents
                .filter((a) => a.isActive)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">
              Task
            </label>
            <textarea
              placeholder="e.g., Check inbox for new emails and summarize unread ones"
              rows={3}
              value={task}
              onChange={(e) => setTask(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
            />
            <p className="text-xs text-muted-foreground mt-1">
              What should the agent do each time it wakes up?
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">
              Frequency
            </label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              {Object.entries(frequencyLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-3 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !agentId || !task.trim()}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Create Heartbeat
          </button>
        </div>
      </div>
    </div>
  );
}
