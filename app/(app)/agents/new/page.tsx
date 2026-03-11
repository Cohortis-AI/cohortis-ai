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
} from "lucide-react";

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    try {
      const selectedModel = models.find((m) => m.value === model);
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          type,
          role: role.trim() || null,
          systemPrompt: systemPrompt.trim() || null,
          model,
          provider: selectedModel?.provider || "openai",
          capabilities: [],
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

        {/* System Prompt */}
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
            Instructions that define this agent&apos;s behavior and personality.
          </p>
        </div>

        {/* Model */}
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
