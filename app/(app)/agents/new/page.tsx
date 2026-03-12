"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Bot,
  Mail,
  Calendar,
  FileText,
  BarChart3,
  Share2,
  ArrowLeft,
  Loader2,
  Globe,
  Lock,
  Plus,
  Trash2,
} from "lucide-react";
import { apiFetch } from "@/lib/api-client";

const agentTypes = [
  {
    value: "general",
    label: "General",
    icon: Bot,
    color: "#7C3AED",
    desc: "Versatile agent for any task",
  },
  {
    value: "email",
    label: "Email",
    icon: Mail,
    color: "#F59E0B",
    desc: "Email management and outreach",
  },
  {
    value: "calendar",
    label: "Calendar",
    icon: Calendar,
    color: "#00D4FF",
    desc: "Scheduling and calendar management",
  },
  {
    value: "documents",
    label: "Documents",
    icon: FileText,
    color: "#9D7CD8",
    desc: "Document creation and analysis",
  },
  {
    value: "data",
    label: "Data",
    icon: BarChart3,
    color: "#22C55E",
    desc: "Data analysis and reporting",
  },
  {
    value: "social",
    label: "Social",
    icon: Share2,
    color: "#F97316",
    desc: "Social media management",
  },
];

const models = [
  { value: "gpt-5.2", label: "GPT-5.2", provider: "openai" },
  { value: "claude-opus-4-6", label: "Claude Opus 4.6", provider: "anthropic" },
  {
    value: "claude-sonnet-4-6",
    label: "Claude Sonnet 4.6",
    provider: "anthropic",
  },
  { value: "gpt-4o-mini", label: "GPT-4o Mini", provider: "openai" },
];

export default function NewAgentPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("general");
  const [role, setRole] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [model, setModel] = useState("gpt-5.2");

  // BYOA
  const [runtime, setRuntime] = useState<"internal" | "external">("internal");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [webhookHeaders, setWebhookHeaders] = useState<
    Array<{ key: string; value: string }>
  >([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (runtime === "external" && !webhookUrl.trim()) {
      toast.error("Webhook URL is required for external agents");
      return;
    }

    setSaving(true);
    try {
      const selectedModel = models.find((m) => m.value === model);

      const headersObj =
        webhookHeaders.length > 0
          ? Object.fromEntries(
              webhookHeaders
                .filter((h) => h.key.trim())
                .map((h) => [h.key.trim(), h.value])
            )
          : null;

      const res = await apiFetch("/api/agents", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          type,
          role: role.trim() || null,
          systemPrompt: systemPrompt.trim() || null,
          model,
          provider: selectedModel?.provider || "openai",
          capabilities: [],
          runtime,
          webhookUrl: runtime === "external" ? webhookUrl.trim() : null,
          webhookSecret:
            runtime === "external" && webhookSecret.trim()
              ? webhookSecret.trim()
              : null,
          webhookHeaders: runtime === "external" ? headersObj : null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Failed to create agent");
        return;
      }

      const agent = await res.json();
      toast.success(`Agent "${agent.name}" created`);
      router.push(`/agents/${agent.id}`);
    } catch {
      toast.error("Failed to create agent");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-8 max-w-2xl">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <h1 className="text-xl font-semibold mb-1">Create Agent</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Define your agent&apos;s identity, instructions, and capabilities.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Runtime toggle */}
        <div>
          <label className="block text-sm font-medium mb-2">Runtime</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setRuntime("internal")}
              className={`flex items-center gap-2.5 px-4 py-3 rounded-lg border text-sm transition-colors ${
                runtime === "internal"
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-primary/30"
              }`}
            >
              <Bot className="w-4 h-4 shrink-0 text-primary" />
              <div className="text-left">
                <div className="font-medium">Internal</div>
                <div className="text-xs text-muted-foreground">
                  Runs on Cohortis AI
                </div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setRuntime("external")}
              className={`flex items-center gap-2.5 px-4 py-3 rounded-lg border text-sm transition-colors ${
                runtime === "external"
                  ? "border-cyan-400 bg-cyan-400/10 text-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-cyan-400/30"
              }`}
            >
              <Globe className="w-4 h-4 shrink-0 text-cyan-400" />
              <div className="text-left">
                <div className="font-medium">External (BYOA)</div>
                <div className="text-xs text-muted-foreground">
                  Your own agent via webhook
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Name */}
        <div>
          <label className="block text-sm font-medium mb-1.5">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Sales Outreach Agent"
            className="w-full px-3 py-2 rounded-lg bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            required
          />
        </div>

        {/* Role */}
        <div>
          <label className="block text-sm font-medium mb-1.5">
            Role <span className="text-muted-foreground">(optional)</span>
          </label>
          <input
            type="text"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="e.g., Head of Outreach"
            className="w-full px-3 py-2 rounded-lg bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        {/* Type */}
        <div>
          <label className="block text-sm font-medium mb-2">Type</label>
          <div className="grid grid-cols-3 gap-2">
            {agentTypes.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setType(t.value)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm transition-colors ${
                  type === t.value
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-card text-muted-foreground hover:border-primary/30"
                }`}
              >
                <t.icon
                  className="w-4 h-4 shrink-0"
                  style={{ color: t.color }}
                />
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium mb-1.5">
            Description <span className="text-muted-foreground">(optional)</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What does this agent do?"
            rows={2}
            className="w-full px-3 py-2 rounded-lg bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
          />
        </div>

        {/* BYOA Webhook Config — only visible for external runtime */}
        {runtime === "external" && (
          <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-4 space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-cyan-400">
              <Globe className="w-4 h-4" />
              Webhook Configuration
            </div>

            {/* Webhook URL */}
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Webhook URL <span className="text-red-400">*</span>
              </label>
              <input
                type="url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://your-api.com/agent/webhook"
                className="w-full px-3 py-2 rounded-lg bg-input border border-border text-sm font-mono focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
                required={runtime === "external"}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Cohortis will POST task payloads to this URL. Expected response:
                {" {\"result\": \"...\", \"status\": \"completed\"}"}
              </p>
            </div>

            {/* Webhook Secret */}
            <div>
              <label className="block text-sm font-medium mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" />
                  Secret Token
                  <span className="text-muted-foreground">(optional)</span>
                </span>
              </label>
              <input
                type="password"
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
                placeholder="Bearer token for authentication"
                className="w-full px-3 py-2 rounded-lg bg-input border border-border text-sm font-mono focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Sent as Authorization: Bearer &lt;token&gt; header
              </p>
            </div>

            {/* Custom Headers */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium">
                  Custom Headers{" "}
                  <span className="text-muted-foreground">(optional)</span>
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setWebhookHeaders([
                      ...webhookHeaders,
                      { key: "", value: "" },
                    ])
                  }
                  className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  Add Header
                </button>
              </div>
              {webhookHeaders.length > 0 && (
                <div className="space-y-2">
                  {webhookHeaders.map((header, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Header name"
                        value={header.key}
                        onChange={(e) => {
                          const updated = [...webhookHeaders];
                          updated[idx].key = e.target.value;
                          setWebhookHeaders(updated);
                        }}
                        className="flex-1 px-3 py-1.5 rounded-lg bg-input border border-border text-xs font-mono focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
                      />
                      <input
                        type="text"
                        placeholder="Value"
                        value={header.value}
                        onChange={(e) => {
                          const updated = [...webhookHeaders];
                          updated[idx].value = e.target.value;
                          setWebhookHeaders(updated);
                        }}
                        className="flex-1 px-3 py-1.5 rounded-lg bg-input border border-border text-xs font-mono focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setWebhookHeaders(
                            webhookHeaders.filter((_, i) => i !== idx)
                          )
                        }
                        className="p-1.5 text-muted-foreground hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* System Prompt — hidden for external agents */}
        {runtime === "internal" && (
          <div>
            <label className="block text-sm font-medium mb-1.5">
              System Prompt
            </label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="You are a specialized agent that..."
              rows={6}
              className="w-full px-3 py-2 rounded-lg bg-input border border-border text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Instructions that define this agent&apos;s behavior and
              personality.
            </p>
          </div>
        )}

        {/* Model — hidden for external agents */}
        {runtime === "internal" && (
          <div>
            <label className="block text-sm font-medium mb-1.5">Model</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              {models.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Submit */}
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Create Agent
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-5 py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
