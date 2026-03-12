"use client";

import { useState, useEffect, useRef } from "react";
import useSWR, { mutate } from "swr";
import {
  Bot,
  Plus,
  Settings,
  Play,
  Pause,
  MoreVertical,
  Globe,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  Loader2,
  Trash2,
  LayoutGrid,
  Network,
  MessageCircle,
  Users,
} from "lucide-react";
import { fetcher, apiFetch } from "@/lib/api-client";
import { CreateAgentDialog } from "@/components/agents/create-agent-dialog";
import { AgentChatDrawer } from "@/components/agents/agent-chat-drawer";
import {
  type AgentData,
  typeIcons,
  typeColors,
  formatAvgTime,
  formatRelativeTime,
} from "@/lib/agents/types";

// ─── Tabs ───

type TabValue = "grid" | "hierarchy" | "team-chat";

const tabs: { value: TabValue; label: string; icon: typeof LayoutGrid }[] = [
  { value: "grid", label: "Grid", icon: LayoutGrid },
  { value: "hierarchy", label: "Hierarchy", icon: Network },
  { value: "team-chat", label: "Team Chat", icon: Users },
];

// ─── Lazy-loaded tab content ───

import dynamic from "next/dynamic";

const HierarchyContent = dynamic(
  () => import("@/app/(app)/hierarchy/page"),
  { loading: () => <TabLoading /> }
);
const TeamChatContent = dynamic(
  () => import("@/app/(app)/team-chat/page"),
  { loading: () => <TabLoading /> }
);

function TabLoading() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );
}

// ─── Page ───

export default function AgentsPage() {
  const { data: agents = [], isLoading } = useSWR<AgentData[]>(
    "/api/agents",
    fetcher,
    { refreshInterval: 5000 }
  );

  const [activeTab, setActiveTab] = useState<TabValue>("grid");
  const [createOpen, setCreateOpen] = useState(false);
  const [editAgent, setEditAgent] = useState<AgentData | null>(null);
  const [chatAgent, setChatAgent] = useState<AgentData | null>(null);
  const [chatOpen, setChatOpen] = useState(false);

  // Keep chat agent in sync with live data
  const liveChatAgent =
    agents.find((a) => a.id === chatAgent?.id) ?? null;

  useEffect(() => {
    if (chatOpen && chatAgent && !liveChatAgent) {
      setChatOpen(false);
      setChatAgent(null);
    }
  }, [chatOpen, chatAgent, liveChatAgent]);

  const handleEditAgent = (agent: AgentData) => {
    setEditAgent(agent);
    setCreateOpen(true);
  };

  const handleOpenChat = (agent: AgentData) => {
    setChatAgent(agent);
    setChatOpen(true);
  };

  const handleCloseChat = () => {
    setChatOpen(false);
    setTimeout(() => setChatAgent(null), 300);
  };

  const activeAgents = agents.filter((a) => a.isActive);
  const totalTasks = agents.reduce(
    (acc, a) => acc + (a.totalTasksCompleted || 0),
    0
  );

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Agents</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Create, manage, and chat with your AI agent team
          </p>
        </div>
        <button
          onClick={() => {
            setEditAgent(null);
            setCreateOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Agent
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-green-400/10 flex items-center justify-center">
            <Zap className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <div className="text-2xl font-semibold text-foreground">
              {activeAgents.length}
            </div>
            <div className="text-sm text-muted-foreground">Active Agents</div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <div className="text-2xl font-semibold text-foreground">
              {totalTasks}
            </div>
            <div className="text-sm text-muted-foreground">
              Tasks Completed
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-cyan-400/10 flex items-center justify-center">
            <Clock className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <div className="text-2xl font-semibold text-foreground">
              {agents.length}
            </div>
            <div className="text-sm text-muted-foreground">Total Agents</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div>
        <div className="flex gap-1 border-b border-border mb-4">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                activeTab === tab.value
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Grid tab */}
        {activeTab === "grid" && (
          <>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : agents.length === 0 ? (
              <div className="rounded-xl border border-border bg-card p-8 text-center">
                <Bot className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-1">
                  No agents yet
                </h3>
                <p className="text-muted-foreground mb-4">
                  Create your first agent to get started
                </p>
                <button
                  onClick={() => setCreateOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Create Agent
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {agents.map((agent) => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    onEdit={() => handleEditAgent(agent)}
                    onChat={() => handleOpenChat(agent)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* Hierarchy tab */}
        {activeTab === "hierarchy" && (
          <div className="-mx-8 -mb-6">
            <HierarchyContent />
          </div>
        )}

        {/* Team Chat tab */}
        {activeTab === "team-chat" && (
          <div className="rounded-xl border border-border bg-card overflow-hidden h-[600px]">
            <TeamChatContent />
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <CreateAgentDialog
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
          setEditAgent(null);
        }}
        editAgent={editAgent}
        agents={agents}
      />

      {/* Chat Drawer */}
      <AgentChatDrawer
        agent={liveChatAgent}
        open={chatOpen}
        onClose={handleCloseChat}
      />
    </div>
  );
}

// ─── Agent Card ───

function AgentCard({
  agent,
  onEdit,
  onChat,
}: {
  agent: AgentData;
  onEdit: () => void;
  onChat: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const isActive = agent.isActive ?? true;
  const agentType = agent.type || "general";
  const AgentIcon = typeIcons[agentType] || Bot;
  const color = typeColors[agentType] || "#7C3AED";

  const handleToggleActive = async () => {
    setMenuOpen(false);
    await apiFetch(`/api/agents/${agent.id}`, {
      method: "PATCH",
      body: JSON.stringify({ isActive: !isActive }),
    });
    mutate("/api/agents");
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this agent?")) return;
    setMenuOpen(false);
    setDeleting(true);
    await apiFetch(`/api/agents/${agent.id}`, { method: "DELETE" });
    mutate("/api/agents");
    setDeleting(false);
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden group">
      {/* Header */}
      <div className="p-4 border-b border-border" style={{ background: `${color}08` }}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: `${color}20` }}
            >
              <AgentIcon className="w-6 h-6" style={{ color }} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-foreground">{agent.name}</h3>
                <div className="flex items-center gap-1.5">
                  <span
                    className={`w-2 h-2 rounded-full ${isActive ? "bg-green-400" : "bg-muted-foreground/30"}`}
                  />
                  <span className="text-xs text-muted-foreground">
                    {isActive ? "Active" : "Paused"}
                  </span>
                </div>
                {agent.runtime === "external" && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-cyan-400/10 text-cyan-400 text-[10px] font-medium">
                    <Globe className="w-2.5 h-2.5" />
                    BYOA
                  </span>
                )}
              </div>
              {agent.role && (
                <p className="text-xs text-primary/80 font-medium mt-0.5">
                  {agent.role}
                </p>
              )}
              <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">
                {agent.description || "No description"}
              </p>
            </div>
          </div>

          {/* Dropdown menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 w-44 bg-card border border-border rounded-lg shadow-lg z-20 py-1">
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onEdit();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary transition-colors"
                >
                  <Settings className="w-4 h-4" />
                  Configure
                </button>
                <button
                  onClick={handleToggleActive}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary transition-colors"
                >
                  {isActive ? (
                    <>
                      <Pause className="w-4 h-4" />
                      Pause
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      Resume
                    </>
                  )}
                </button>
                <div className="h-px bg-border my-1" />
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-secondary transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats + Chat Button */}
      <div className="p-4">
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <div className="text-lg font-semibold text-foreground">
              {agent.totalTasksCompleted || 0}
            </div>
            <div className="text-xs text-muted-foreground">Tasks done</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-foreground">
              {formatAvgTime(agent.averageExecutionTime)}
            </div>
            <div className="text-xs text-muted-foreground">Avg time</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-foreground">
              {formatRelativeTime(agent.lastActiveAt)}
            </div>
            <div className="text-xs text-muted-foreground">Last active</div>
          </div>
        </div>

        {/* Skills badges */}
        {agent.capabilities && agent.capabilities.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {agent.capabilities.slice(0, 4).map((skillId, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium border border-primary/20"
              >
                <Zap className="w-3 h-3" />
                {skillId}
              </span>
            ))}
            {agent.capabilities.length > 4 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-secondary text-xs text-muted-foreground">
                +{agent.capabilities.length - 4}
              </span>
            )}
          </div>
        )}

        {/* Custom skills badges */}
        {agent.customSkills && agent.customSkills.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {agent.customSkills.map((skill) => (
              <span
                key={skill.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium border border-primary/20"
              >
                <Zap className="w-3 h-3" />
                {skill.name}
              </span>
            ))}
          </div>
        )}

        {/* Chat button */}
        {isActive && (
          <button
            onClick={onChat}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
            Chat with {agent.name}
          </button>
        )}
      </div>
    </div>
  );
}

