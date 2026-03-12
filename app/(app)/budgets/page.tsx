"use client";

import { useState } from "react";
import useSWR, { mutate } from "swr";
import { toast } from "sonner";
import {
  DollarSign,
  Plus,
  Loader2,
  Trash2,
  AlertTriangle,
  Bot,
  X,
  TrendingUp,
  ShieldAlert,
} from "lucide-react";
import { fetcher, apiFetch } from "@/lib/api-client";

interface Budget {
  id: string;
  agentId: string;
  monthlyLimitUsd: string;
  currentSpendUsd: string;
  warningThreshold: number;
  isThrottled: boolean;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
}

interface AgentBasic {
  id: string;
  name: string;
  type: string | null;
}

function getSpendPercentage(budget: Budget): number {
  const limit = parseFloat(budget.monthlyLimitUsd);
  const spent = parseFloat(budget.currentSpendUsd);
  return limit > 0 ? Math.min(Math.round((spent / limit) * 100), 100) : 0;
}

function getBarColor(percentage: number, threshold: number): string {
  if (percentage >= 100) return "bg-red-500";
  if (percentage >= threshold) return "bg-amber-400";
  return "bg-green-400";
}

export default function BudgetsPage() {
  const { data: budgets = [], isLoading } = useSWR<Budget[]>(
    "/api/budgets",
    fetcher,
    { refreshInterval: 10000 }
  );
  const { data: agents = [] } = useSWR<AgentBasic[]>("/api/agents", fetcher);

  const [createOpen, setCreateOpen] = useState(false);

  const totalLimit = budgets.reduce(
    (acc, b) => acc + parseFloat(b.monthlyLimitUsd),
    0
  );
  const totalSpent = budgets.reduce(
    (acc, b) => acc + parseFloat(b.currentSpendUsd),
    0
  );
  const throttledCount = budgets.filter((b) => b.isThrottled).length;

  // Agents without a budget
  const budgetedAgentIds = new Set(budgets.map((b) => b.agentId));

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Budgets</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Per-agent cost caps with automatic throttling
          </p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Set Budget
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-green-400/10 flex items-center justify-center">
            <DollarSign className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <div className="text-2xl font-semibold">
              ${totalSpent.toFixed(2)}
            </div>
            <div className="text-sm text-muted-foreground">
              of ${totalLimit.toFixed(2)} spent
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-primary" />
          </div>
          <div>
            <div className="text-2xl font-semibold">{budgets.length}</div>
            <div className="text-sm text-muted-foreground">Budgets Set</div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-4">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              throttledCount > 0 ? "bg-red-500/10" : "bg-cyan-400/10"
            }`}
          >
            <ShieldAlert
              className={`w-5 h-5 ${
                throttledCount > 0 ? "text-red-500" : "text-cyan-400"
              }`}
            />
          </div>
          <div>
            <div className="text-2xl font-semibold">{throttledCount}</div>
            <div className="text-sm text-muted-foreground">Throttled</div>
          </div>
        </div>
      </div>

      {/* Budget cards */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : budgets.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <DollarSign className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-1">
            No budgets set
          </h3>
          <p className="text-muted-foreground mb-4">
            Set monthly spending limits per agent to prevent cost overruns
          </p>
          <button
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Set First Budget
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {budgets.map((budget) => {
            const agent = agents.find((a) => a.id === budget.agentId);
            const pct = getSpendPercentage(budget);
            const barColor = getBarColor(pct, budget.warningThreshold);
            const spent = parseFloat(budget.currentSpendUsd);
            const limit = parseFloat(budget.monthlyLimitUsd);

            return (
              <div
                key={budget.id}
                className={`rounded-xl border bg-card p-4 ${
                  budget.isThrottled
                    ? "border-red-500/30"
                    : "border-border"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                      <Bot className="w-3 h-3" />
                      {agent?.name || "Unknown"}
                    </span>
                    {budget.isThrottled && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 text-xs font-medium">
                        <AlertTriangle className="w-3 h-3" />
                        Throttled
                      </span>
                    )}
                  </div>
                  <button
                    onClick={async () => {
                      if (!confirm("Remove this budget?")) return;
                      await apiFetch(`/api/budgets/${budget.id}`, {
                        method: "DELETE",
                      });
                      mutate("/api/budgets");
                      toast.success("Budget removed");
                    }}
                    className="p-1 text-muted-foreground/40 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Spend bar */}
                <div className="mb-2">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">
                      ${spent.toFixed(2)} spent
                    </span>
                    <span className="text-muted-foreground">
                      ${limit.toFixed(2)} limit
                    </span>
                  </div>
                  <div className="h-2.5 bg-secondary rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${barColor}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs mt-1">
                    <span className="text-muted-foreground">{pct}% used</span>
                    <span className="text-muted-foreground">
                      Warn at {budget.warningThreshold}%
                    </span>
                  </div>
                </div>

                {/* Period */}
                <p className="text-xs text-muted-foreground mt-2">
                  Period:{" "}
                  {new Date(budget.periodStart).toLocaleDateString()} —{" "}
                  {new Date(budget.periodEnd).toLocaleDateString()}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      {createOpen && (
        <CreateBudgetDialog
          agents={agents.filter((a) => !budgetedAgentIds.has(a.id))}
          onClose={() => setCreateOpen(false)}
        />
      )}
    </div>
  );
}

// ─── Create Budget Dialog ───

function CreateBudgetDialog({
  agents,
  onClose,
}: {
  agents: AgentBasic[];
  onClose: () => void;
}) {
  const [agentId, setAgentId] = useState("");
  const [monthlyLimit, setMonthlyLimit] = useState("50");
  const [warningThreshold, setWarningThreshold] = useState(80);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!agentId || !monthlyLimit) return;
    setSaving(true);
    try {
      const res = await apiFetch("/api/budgets", {
        method: "POST",
        body: JSON.stringify({
          agentId,
          monthlyLimitUsd: monthlyLimit,
          warningThreshold,
        }),
      });
      if (!res.ok) throw new Error();
      mutate("/api/budgets");
      toast.success("Budget set");
      onClose();
    } catch {
      toast.error("Failed to set budget");
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
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold">Set Agent Budget</h2>
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
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">
              Monthly Limit (USD)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                $
              </span>
              <input
                type="number"
                min="1"
                step="1"
                value={monthlyLimit}
                onChange={(e) => setMonthlyLimit(e.target.value)}
                className="w-full pl-7 pr-3 py-2 rounded-lg bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">
              Warning Threshold ({warningThreshold}%)
            </label>
            <input
              type="range"
              min="50"
              max="95"
              step="5"
              value={warningThreshold}
              onChange={(e) => setWarningThreshold(Number(e.target.value))}
              className="w-full accent-primary"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Alert when agent reaches {warningThreshold}% of budget. Auto-throttle at 100%.
            </p>
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
            disabled={saving || !agentId || !monthlyLimit}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Set Budget
          </button>
        </div>
      </div>
    </div>
  );
}
