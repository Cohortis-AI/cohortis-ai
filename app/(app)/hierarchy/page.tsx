"use client";

import { useState, useCallback } from "react";
import useSWR, { mutate } from "swr";
import { toast } from "sonner";
import {
  Bot,
  Plus,
  GitBranch,
  ChevronDown,
  ChevronRight,
  GripVertical,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";
import Link from "next/link";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface HierarchyAgent {
  id: string;
  name: string;
  description: string | null;
  type: string | null;
  icon: string | null;
  role: string | null;
  parentAgentId: string | null;
  isActive: boolean | null;
  totalTasksCompleted: number | null;
  totalTasksFailed: number | null;
  model: string | null;
}

interface TreeNode extends HierarchyAgent {
  children: TreeNode[];
  depth: number;
}

function buildTree(agents: HierarchyAgent[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  // Initialize
  for (const agent of agents) {
    map.set(agent.id, { ...agent, children: [], depth: 0 });
  }

  // Build tree
  for (const agent of agents) {
    const node = map.get(agent.id)!;
    if (agent.parentAgentId && map.has(agent.parentAgentId)) {
      const parent = map.get(agent.parentAgentId)!;
      node.depth = parent.depth + 1;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // Fix depths recursively
  function setDepths(node: TreeNode, depth: number) {
    node.depth = depth;
    for (const child of node.children) {
      setDepths(child, depth + 1);
    }
  }
  for (const root of roots) {
    setDepths(root, 0);
  }

  return roots;
}

const typeColors: Record<string, string> = {
  general: "#7C3AED",
  email: "#F59E0B",
  calendar: "#00D4FF",
  documents: "#9D7CD8",
  data: "#22C55E",
  social: "#F97316",
  custom: "#6366F1",
};

function AgentNode({
  node,
  onDrop,
  draggedId,
  setDraggedId,
}: {
  node: TreeNode;
  onDrop: (agentId: string, newParentId: string | null) => void;
  draggedId: string | null;
  setDraggedId: (id: string | null) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [dropHover, setDropHover] = useState(false);
  const color = typeColors[node.type || "general"] || typeColors.general;
  const hasChildren = node.children.length > 0;

  return (
    <div className="relative">
      {/* Connector line from parent */}
      {node.depth > 0 && (
        <div className="absolute -top-4 left-5 w-px h-4 bg-border" />
      )}

      <div
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData("text/plain", node.id);
          setDraggedId(node.id);
        }}
        onDragEnd={() => setDraggedId(null)}
        onDragOver={(e) => {
          e.preventDefault();
          if (draggedId && draggedId !== node.id) {
            setDropHover(true);
          }
        }}
        onDragLeave={() => setDropHover(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDropHover(false);
          const droppedId = e.dataTransfer.getData("text/plain");
          if (droppedId && droppedId !== node.id && node.depth < 2) {
            onDrop(droppedId, node.id);
          }
        }}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all cursor-grab active:cursor-grabbing group ${
          dropHover && node.depth < 2
            ? "border-primary bg-primary/5 ring-1 ring-primary/30"
            : draggedId === node.id
              ? "opacity-50 border-border bg-card"
              : "border-border bg-card hover:border-primary/20"
        }`}
      >
        <GripVertical className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />

        {hasChildren && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            {collapsed ? (
              <ChevronRight className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        )}

        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${color}15` }}
        >
          <Bot className="w-4 h-4" style={{ color }} />
        </div>

        <div className="flex-1 min-w-0">
          <Link
            href={`/agents/${node.id}`}
            className="text-sm font-medium hover:text-primary transition-colors truncate block"
          >
            {node.name}
          </Link>
          {node.role && (
            <p className="text-[11px] text-muted-foreground truncate">
              {node.role}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 text-[11px] text-muted-foreground shrink-0">
          <span className="flex items-center gap-0.5">
            <CheckCircle2 className="w-3 h-3 text-green-500" />
            {node.totalTasksCompleted || 0}
          </span>
          <span className="flex items-center gap-0.5">
            <XCircle className="w-3 h-3 text-red-500" />
            {node.totalTasksFailed || 0}
          </span>
          <span
            className={`w-1.5 h-1.5 rounded-full ${node.isActive ? "bg-green-500" : "bg-red-500"}`}
          />
        </div>
      </div>

      {/* Children */}
      {hasChildren && !collapsed && (
        <div className="ml-8 mt-1 space-y-1 relative">
          {/* Vertical line */}
          <div
            className="absolute left-[-12px] top-0 w-px bg-border"
            style={{
              height: `calc(100% - 1rem)`,
            }}
          />
          {node.children.map((child) => (
            <div key={child.id} className="relative">
              {/* Horizontal line */}
              <div className="absolute -left-[12px] top-5 w-3 h-px bg-border" />
              <AgentNode
                node={child}
                onDrop={onDrop}
                draggedId={draggedId}
                setDraggedId={setDraggedId}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function HierarchyPage() {
  const { data: agents, isLoading } = useSWR("/api/hierarchy", fetcher);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleDrop = useCallback(
    async (agentId: string, newParentId: string | null) => {
      setSaving(true);
      try {
        const res = await fetch(`/api/agents/${agentId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ parentAgentId: newParentId }),
        });

        if (!res.ok) {
          const err = await res.json();
          toast.error(err.error || "Failed to update hierarchy");
          return;
        }

        toast.success("Hierarchy updated");
        mutate("/api/hierarchy");
      } catch {
        toast.error("Failed to update hierarchy");
      } finally {
        setSaving(false);
      }
    },
    []
  );

  const tree = agents ? buildTree(agents) : [];

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-primary" />
            Agent Hierarchy
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Drag agents to reorganize. Max depth: 3 levels.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {saving && (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          )}
          <Link
            href="/agents/new"
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Agent
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-14 rounded-xl border border-border bg-card animate-pulse"
            />
          ))}
        </div>
      ) : tree.length === 0 ? (
        <div className="text-center py-16">
          <GitBranch className="w-12 h-12 mx-auto text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-medium mb-2">No agents yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Create agents and drag them to build your hierarchy
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
        <div
          className="space-y-1"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const droppedId = e.dataTransfer.getData("text/plain");
            if (droppedId && e.target === e.currentTarget) {
              handleDrop(droppedId, null);
            }
          }}
        >
          {tree.map((root) => (
            <AgentNode
              key={root.id}
              node={root}
              onDrop={handleDrop}
              draggedId={draggedId}
              setDraggedId={setDraggedId}
            />
          ))}

          <div className="mt-4 py-3 border-2 border-dashed border-border/50 rounded-xl text-center text-xs text-muted-foreground">
            Drop here to make an agent a root agent
          </div>
        </div>
      )}
    </div>
  );
}
