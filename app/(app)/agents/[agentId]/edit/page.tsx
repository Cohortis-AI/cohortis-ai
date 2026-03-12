"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { toast } from "sonner";
import {
  ArrowLeft,
  Save,
  Loader2,
  Trash2,
  Bot,
  Mail,
  Calendar,
  FileText,
  BarChart3,
  Share2,
} from "lucide-react";
import { fetcher, apiFetch } from "@/lib/api-client";

const agentTypes = [
  { value: "general", label: "General", icon: Bot, color: "#7C3AED" },
  { value: "email", label: "Email", icon: Mail, color: "#F59E0B" },
  { value: "calendar", label: "Calendar", icon: Calendar, color: "#00D4FF" },
  { value: "documents", label: "Documents", icon: FileText, color: "#9D7CD8" },
  { value: "data", label: "Data", icon: BarChart3, color: "#22C55E" },
  { value: "social", label: "Social", icon: Share2, color: "#F97316" },
];

const models = [
  { value: "gpt-5.2", label: "GPT-5.2", provider: "openai" },
  { value: "claude-opus-4-6", label: "Claude Opus 4.6", provider: "anthropic" },
  { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", provider: "anthropic" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini", provider: "openai" },
];

export default function EditAgentPage() {
  const { agentId } = useParams<{ agentId: string }>();
  const router = useRouter();
  const { data: agent, isLoading } = useSWR(
    `/api/agents/${agentId}`,
    fetcher
  );

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("general");
  const [role, setRole] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [model, setModel] = useState("gpt-5.2");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (agent && !agent.error) {
      setName(agent.name || "");
      setDescription(agent.description || "");
      setType(agent.type || "general");
      setRole(agent.role || "");
      setSystemPrompt(agent.systemPrompt || "");
      setModel(agent.model || "gpt-5.2");
      setIsActive(agent.isActive ?? true);
    }
  }, [agent]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const selectedModel = models.find((m) => m.value === model);
      const res = await apiFetch(`/api/agents/${agentId}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          type,
          role: role.trim() || null,
          systemPrompt: systemPrompt.trim() || null,
          model,
          provider: selectedModel?.provider || "openai",
          isActive,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Failed to save");
        return;
      }

      toast.success("Agent updated");
      router.push(`/agents/${agentId}`);
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this agent? This cannot be undone.")) return;
    setDeleting(true);
    try {
      const res = await apiFetch(`/api/agents/${agentId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        toast.error("Failed to delete");
        return;
      }
      toast.success("Agent deleted");
      router.push("/agents");
    } catch {
      toast.error("Failed to delete");
    } finally {
      setDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!agent || agent.error) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Agent not found</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-2xl">
      <button
        onClick={() => router.push(`/agents/${agentId}`)}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to agent
      </button>

      <h1 className="text-xl font-semibold mb-1">Edit Agent</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Update {agent.name}&apos;s configuration
      </p>

      <div className="space-y-6">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium mb-1.5">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        {/* Role */}
        <div>
          <label className="block text-sm font-medium mb-1.5">Role</label>
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
                <t.icon className="w-4 h-4 shrink-0" style={{ color: t.color }} />
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium mb-1.5">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 rounded-lg bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
          />
        </div>

        {/* System Prompt */}
        <div>
          <label className="block text-sm font-medium mb-1.5">System Prompt</label>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            rows={8}
            className="w-full px-3 py-2 rounded-lg bg-input border border-border text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
          />
          {agent.promptHistory?.length > 0 && (
            <p className="text-[11px] text-muted-foreground mt-1">
              {agent.promptHistory.length} prompt change{agent.promptHistory.length > 1 ? "s" : ""} in history
            </p>
          )}
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

        {/* Active toggle */}
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm font-medium">Active</p>
            <p className="text-xs text-muted-foreground">
              Paused agents won&apos;t receive delegated tasks
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsActive(!isActive)}
            className={`w-10 h-6 rounded-full transition-colors ${
              isActive ? "bg-primary" : "bg-secondary"
            }`}
          >
            <span
              className={`block w-4 h-4 rounded-full bg-white transition-transform mx-1 ${
                isActive ? "translate-x-4" : ""
              }`}
            />
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-border">
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
          >
            {deleting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            Delete Agent
          </button>
          <div className="flex gap-3">
            <button
              onClick={() => router.push(`/agents/${agentId}`)}
              className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !name.trim()}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              <Save className="w-4 h-4" />
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
