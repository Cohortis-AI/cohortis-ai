"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Settings, Save, Loader2, Brain } from "lucide-react";
import { fetcher, apiFetch } from "@/lib/api-client";

export default function SettingsPage() {
  const { data: workspace, mutate } = useSWR("/api/workspaces/current", fetcher);

  const [mission, setMission] = useState("");
  const [teamContext, setTeamContext] = useState("");
  const [orgContext, setOrgContext] = useState("");
  const [saving, setSaving] = useState(false);

  // Load existing shared memory
  useEffect(() => {
    if (workspace?.sharedMemory) {
      setMission(workspace.sharedMemory.mission || "");
      setTeamContext(workspace.sharedMemory.teamContext || "");
      setOrgContext(workspace.sharedMemory.orgContext || "");
    }
  }, [workspace]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await apiFetch("/api/workspaces/current", {
        method: "PATCH",
        body: JSON.stringify({
          sharedMemory: { mission, teamContext, orgContext },
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Failed to save");
        return;
      }
      mutate();
      toast.success("Settings saved");
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-xl font-semibold flex items-center gap-2 mb-1">
        <Settings className="w-5 h-5 text-primary" />
        Settings
      </h1>
      <p className="text-sm text-muted-foreground mb-6">
        Configure your workspace and shared agent memory
      </p>

      <div className="space-y-6">
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-medium flex items-center gap-2 mb-4">
            <Brain className="w-4 h-4 text-primary" />
            Shared Memory
          </h3>
          <p className="text-xs text-muted-foreground mb-4">
            Context shared across all agents in this workspace. Agents use this
            to stay aligned with your team&apos;s mission and goals.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Mission
              </label>
              <textarea
                value={mission}
                onChange={(e) => setMission(e.target.value)}
                placeholder="What is your team's mission? What are you trying to achieve?"
                rows={3}
                className="w-full px-3 py-2 rounded-lg bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">
                Team Context
              </label>
              <textarea
                value={teamContext}
                onChange={(e) => setTeamContext(e.target.value)}
                placeholder="Key information about your team, products, or customers that all agents should know"
                rows={3}
                className="w-full px-3 py-2 rounded-lg bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">
                Organization Context
              </label>
              <textarea
                value={orgContext}
                onChange={(e) => setOrgContext(e.target.value)}
                placeholder="Company-wide guidelines, tone of voice, brand rules, compliance requirements"
                rows={3}
                className="w-full px-3 py-2 rounded-lg bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
              />
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
