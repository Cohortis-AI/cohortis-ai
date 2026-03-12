"use client";

import { useState } from "react";
import useSWR, { mutate } from "swr";
import { toast } from "sonner";
import {
  Target,
  Plus,
  ChevronRight,
  ChevronDown,
  Loader2,
  Trash2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Bot,
  X,
} from "lucide-react";
import { fetcher, apiFetch } from "@/lib/api-client";

interface Goal {
  id: string;
  parentGoalId: string | null;
  assignedAgentId: string | null;
  title: string;
  description: string | null;
  status: "active" | "completed" | "cancelled";
  priority: number;
  progress: number;
  dueAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

interface AgentBasic {
  id: string;
  name: string;
  type: string | null;
}

const priorityLabels: Record<number, { label: string; color: string }> = {
  0: { label: "Low", color: "text-muted-foreground" },
  1: { label: "Medium", color: "text-blue-400" },
  2: { label: "High", color: "text-amber-400" },
  3: { label: "Critical", color: "text-red-400" },
};

export default function GoalsPage() {
  const { data: goals = [], isLoading } = useSWR<Goal[]>(
    "/api/goals",
    fetcher
  );
  const { data: agents = [] } = useSWR<AgentBasic[]>("/api/agents", fetcher);

  const [createOpen, setCreateOpen] = useState(false);
  const [expandedGoals, setExpandedGoals] = useState<Set<string>>(new Set());

  const rootGoals = goals.filter((g) => !g.parentGoalId);
  const getSubGoals = (parentId: string) =>
    goals.filter((g) => g.parentGoalId === parentId);

  const toggleExpand = (id: string) => {
    setExpandedGoals((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const activeGoals = goals.filter((g) => g.status === "active");
  const completedGoals = goals.filter((g) => g.status === "completed");
  const avgProgress =
    activeGoals.length > 0
      ? Math.round(
          activeGoals.reduce((acc, g) => acc + (g.progress || 0), 0) /
            activeGoals.length
        )
      : 0;

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Goals</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Mission-aligned objectives with full traceability
          </p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Goal
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Target className="w-5 h-5 text-primary" />
          </div>
          <div>
            <div className="text-2xl font-semibold">{activeGoals.length}</div>
            <div className="text-sm text-muted-foreground">Active Goals</div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-green-400/10 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <div className="text-2xl font-semibold">
              {completedGoals.length}
            </div>
            <div className="text-sm text-muted-foreground">Completed</div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-cyan-400/10 flex items-center justify-center">
            <Clock className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <div className="text-2xl font-semibold">{avgProgress}%</div>
            <div className="text-sm text-muted-foreground">Avg Progress</div>
          </div>
        </div>
      </div>

      {/* Goals Tree */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : rootGoals.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <Target className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-1">
            No goals yet
          </h3>
          <p className="text-muted-foreground mb-4">
            Define your mission and break it into actionable goals
          </p>
          <button
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Create First Goal
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {rootGoals.map((goal) => (
            <GoalRow
              key={goal.id}
              goal={goal}
              depth={0}
              subGoals={getSubGoals}
              agents={agents}
              expanded={expandedGoals}
              toggleExpand={toggleExpand}
            />
          ))}
        </div>
      )}

      {/* Create Dialog */}
      {createOpen && (
        <CreateGoalDialog
          goals={goals}
          agents={agents}
          onClose={() => setCreateOpen(false)}
        />
      )}
    </div>
  );
}

// ─── Goal Row ───

function GoalRow({
  goal,
  depth,
  subGoals,
  agents,
  expanded,
  toggleExpand,
}: {
  goal: Goal;
  depth: number;
  subGoals: (parentId: string) => Goal[];
  agents: AgentBasic[];
  expanded: Set<string>;
  toggleExpand: (id: string) => void;
}) {
  const children = subGoals(goal.id);
  const hasChildren = children.length > 0;
  const isExpanded = expanded.has(goal.id);
  const assignedAgent = agents.find((a) => a.id === goal.assignedAgentId);
  const priority = priorityLabels[goal.priority] || priorityLabels[0];

  const handleStatusChange = async (
    status: "active" | "completed" | "cancelled"
  ) => {
    await apiFetch(`/api/goals/${goal.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        status,
        ...(status === "completed" ? { progress: 100 } : {}),
      }),
    });
    mutate("/api/goals");
  };

  const handleDelete = async () => {
    if (!confirm("Delete this goal and all sub-goals?")) return;
    await apiFetch(`/api/goals/${goal.id}`, { method: "DELETE" });
    mutate("/api/goals");
    toast.success("Goal deleted");
  };

  return (
    <>
      <div
        className={`rounded-lg border border-border bg-card px-4 py-3 flex items-center gap-3 hover:border-border/80 transition-colors ${
          goal.status === "completed" ? "opacity-60" : ""
        }`}
        style={{ marginLeft: depth * 24 }}
      >
        {/* Expand/collapse */}
        <button
          onClick={() => hasChildren && toggleExpand(goal.id)}
          className={`w-5 h-5 flex items-center justify-center shrink-0 ${
            hasChildren
              ? "text-muted-foreground hover:text-foreground cursor-pointer"
              : "text-transparent"
          }`}
        >
          {hasChildren &&
            (isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            ))}
        </button>

        {/* Status toggle */}
        <button
          onClick={() =>
            handleStatusChange(
              goal.status === "completed" ? "active" : "completed"
            )
          }
          className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors ${
            goal.status === "completed"
              ? "bg-green-500 border-green-500"
              : "border-muted-foreground/40 hover:border-primary"
          }`}
        >
          {goal.status === "completed" && (
            <CheckCircle2 className="w-3 h-3 text-white" />
          )}
        </button>

        {/* Title + description */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`font-medium text-sm ${
                goal.status === "completed"
                  ? "line-through text-muted-foreground"
                  : "text-foreground"
              }`}
            >
              {goal.title}
            </span>
            <span className={`text-xs font-medium ${priority.color}`}>
              {priority.label}
            </span>
          </div>
          {goal.description && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {goal.description}
            </p>
          )}
        </div>

        {/* Assigned agent */}
        {assignedAgent && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs shrink-0">
            <Bot className="w-3 h-3" />
            {assignedAgent.name}
          </span>
        )}

        {/* Progress bar */}
        <div className="w-20 shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${goal.progress || 0}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground w-7 text-right">
              {goal.progress || 0}%
            </span>
          </div>
        </div>

        {/* Due date */}
        {goal.dueAt && (
          <span className="text-xs text-muted-foreground shrink-0">
            {new Date(goal.dueAt).toLocaleDateString()}
          </span>
        )}

        {/* Delete */}
        <button
          onClick={handleDelete}
          className="p-1 text-muted-foreground/40 hover:text-red-400 transition-colors shrink-0"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Sub-goals */}
      {hasChildren && isExpanded && (
        <div className="space-y-2">
          {children.map((child) => (
            <GoalRow
              key={child.id}
              goal={child}
              depth={depth + 1}
              subGoals={subGoals}
              agents={agents}
              expanded={expanded}
              toggleExpand={toggleExpand}
            />
          ))}
        </div>
      )}
    </>
  );
}

// ─── Create Goal Dialog ───

function CreateGoalDialog({
  goals,
  agents,
  onClose,
}: {
  goals: Goal[];
  agents: AgentBasic[];
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [parentGoalId, setParentGoalId] = useState("");
  const [assignedAgentId, setAssignedAgentId] = useState("");
  const [priority, setPriority] = useState(1);
  const [dueAt, setDueAt] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const res = await apiFetch("/api/goals", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          parentGoalId: parentGoalId || null,
          assignedAgentId: assignedAgentId || null,
          priority,
          dueAt: dueAt || null,
        }),
      });
      if (!res.ok) throw new Error();
      mutate("/api/goals");
      toast.success("Goal created");
      onClose();
    } catch {
      toast.error("Failed to create goal");
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
          <h2 className="text-base font-semibold">Create Goal</h2>
          <button
            onClick={onClose}
            className="p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Title</label>
            <input
              type="text"
              placeholder="e.g., Increase MRR to $10K"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">
              Description
            </label>
            <textarea
              placeholder="What does success look like?"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Parent Goal
              </label>
              <select
                value={parentGoalId}
                onChange={(e) => setParentGoalId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="">None (root goal)</option>
                {goals
                  .filter((g) => g.status === "active")
                  .map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.title}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Assign to Agent
              </label>
              <select
                value={assignedAgentId}
                onChange={(e) => setAssignedAgentId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="">Unassigned</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value={0}>Low</option>
                <option value={1}>Medium</option>
                <option value={2}>High</option>
                <option value={3}>Critical</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Due Date
              </label>
              <input
                type="date"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
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
            disabled={saving || !title.trim()}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Create Goal
          </button>
        </div>
      </div>
    </div>
  );
}
