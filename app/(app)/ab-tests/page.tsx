"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  FlaskConical,
  Bot,
  TrendingUp,
  Trophy,
  Loader2,
  Rocket,
  CheckCircle2,
  BarChart3,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { fetcher, apiFetch } from "@/lib/api-client";

export default function ABTestsPage() {
  const { data: agents = [] } = useSWR("/api/agents", fetcher);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-primary" />
            A/B Tests
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Test prompt variants and auto-deploy winners
          </p>
        </div>
      </div>

      {/* How it works */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <FlaskConical className="w-3.5 h-3.5 text-primary" />
            </div>
            <span className="text-xs font-medium">1. Create Variants</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Create prompt variants on agent pages to test different instructions.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-yellow-500/10 flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5 text-yellow-500" />
            </div>
            <span className="text-xs font-medium">2. Run & Measure</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Each execution randomly uses a variant. Success rate and speed are
            tracked automatically.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-green-500/10 flex items-center justify-center">
              <Trophy className="w-3.5 h-3.5 text-green-500" />
            </div>
            <span className="text-xs font-medium">3. Auto-Deploy Winner</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            When a variant outperforms the control by 15%+ (min 10 runs), it
            auto-deploys as the new prompt.
          </p>
        </div>
      </div>

      {/* Per-agent variant panels */}
      {Array.isArray(agents) && agents.length > 0 ? (
        <div className="space-y-4">
          {agents.map((agent: any) => (
            <AgentVariantsPanel key={agent.id} agent={agent} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <FlaskConical className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">
            Create agents to start A/B testing their prompts
          </p>
        </div>
      )}
    </div>
  );
}

function AgentVariantsPanel({ agent }: { agent: any }) {
  const {
    data: variants = [],
    isLoading,
    mutate,
  } = useSWR(`/api/agents/${agent.id}/ab-tests`, fetcher);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPrompt, setNewPrompt] = useState("");
  const [creating, setCreating] = useState(false);
  const [deploying, setDeploying] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!newName.trim() || !newPrompt.trim()) return;
    setCreating(true);
    try {
      await apiFetch(`/api/agents/${agent.id}/ab-tests`, {
        method: "POST",
        body: JSON.stringify({
          name: newName,
          systemPrompt: newPrompt,
        }),
      });
      setShowCreate(false);
      setNewName("");
      setNewPrompt("");
      mutate();
      toast.success("Variant created");
    } catch {
      toast.error("Failed to create variant");
    } finally {
      setCreating(false);
    }
  };

  const handleDeploy = async (variantId: string) => {
    setDeploying(variantId);
    try {
      const res = await apiFetch(`/api/agents/${agent.id}/ab-tests/deploy`, {
        method: "POST",
        body: JSON.stringify({ variantId }),
      });
      const data = await res.json();
      if (data.deployed) {
        toast.success(`Deployed "${data.variantName}" to ${agent.name}`);
        mutate();
      } else {
        toast.error(data.error || "Deploy failed");
      }
    } catch {
      toast.error("Deploy failed");
    } finally {
      setDeploying(null);
    }
  };

  const activeVariants = Array.isArray(variants)
    ? variants.filter((v: any) => v.isActive)
    : [];

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Bot className="w-3.5 h-3.5 text-primary" />
          </div>
          <div>
            <span className="text-sm font-medium">{agent.name}</span>
            <span className="text-xs text-muted-foreground ml-2">
              {activeVariants.length} variant
              {activeVariants.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
        >
          <Plus className="w-3 h-3" />
          New Variant
        </button>
      </div>

      {/* Create variant form */}
      {showCreate && (
        <div className="px-4 py-3 border-b border-border bg-secondary/30">
          <div className="space-y-2">
            <input
              placeholder="Variant name (e.g., 'More concise')"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <textarea
              placeholder="System prompt for this variant..."
              value={newPrompt}
              onChange={(e) => setNewPrompt(e.target.value)}
              rows={3}
              className="w-full px-3 py-1.5 rounded-lg bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowCreate(false)}
                className="px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !newName.trim() || !newPrompt.trim()}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground disabled:opacity-50 transition-colors"
              >
                {creating ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  "Create"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Variants table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      ) : activeVariants.length === 0 ? (
        <div className="px-4 py-5 text-center">
          <p className="text-xs text-muted-foreground">
            No variants yet. Create one to start A/B testing.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {activeVariants.map((variant: any) => {
            const score = parseFloat(variant.score || "0");
            const successRate =
              variant.totalRuns > 0
                ? (
                    ((variant.successRuns || 0) / variant.totalRuns) *
                    100
                  ).toFixed(0)
                : "—";
            const isDeployed = variant.deployedAt != null;

            return (
              <div
                key={variant.id}
                className="flex items-center gap-4 px-4 py-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">
                      {variant.name}
                    </span>
                    {variant.isControl && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-400 font-medium">
                        Control
                      </span>
                    )}
                    {isDeployed && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-400 font-medium flex items-center gap-0.5">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        Deployed
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                    {variant.systemPrompt?.slice(0, 80)}...
                  </p>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 text-xs shrink-0">
                  <div className="text-center">
                    <div className="font-medium">{variant.totalRuns || 0}</div>
                    <div className="text-[10px] text-muted-foreground">
                      Runs
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium">{successRate}%</div>
                    <div className="text-[10px] text-muted-foreground">
                      Success
                    </div>
                  </div>
                  <div className="text-center">
                    <div
                      className={`font-medium ${
                        score >= 70
                          ? "text-green-400"
                          : score >= 40
                            ? "text-yellow-400"
                            : "text-muted-foreground"
                      }`}
                    >
                      {score > 0 ? score.toFixed(1) : "—"}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      Score
                    </div>
                  </div>
                  {variant.avgDurationMs && (
                    <div className="text-center">
                      <div className="font-medium">
                        {(variant.avgDurationMs / 1000).toFixed(1)}s
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        Avg
                      </div>
                    </div>
                  )}
                </div>

                {/* Deploy button */}
                {!isDeployed && !variant.isControl && (
                  <button
                    onClick={() => handleDeploy(variant.id)}
                    disabled={deploying === variant.id}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50 transition-colors shrink-0"
                    title="Deploy this variant as the agent's new prompt"
                  >
                    {deploying === variant.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <>
                        <Rocket className="w-3 h-3" />
                        Deploy
                      </>
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
