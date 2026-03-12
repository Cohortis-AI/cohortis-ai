"use client";

import { useState, useMemo, useCallback } from "react";
import useSWR, { mutate } from "swr";
import { toast } from "sonner";
import Link from "next/link";
import {
  Bot,
  User,
  GripVertical,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Plus,
  Loader2,
  GitBranch,
  Settings,
} from "lucide-react";
import { fetcher, apiFetch } from "@/lib/api-client";

// ─── Types ───

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

interface HierarchyNode {
  agent: HierarchyAgent;
  children: HierarchyNode[];
}

interface DragHandlers {
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent, id: string) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, parentId: string | null) => void;
}

// ─── Constants ───

const typeColors: Record<string, string> = {
  general: "#7C3AED",
  email: "#F59E0B",
  calendar: "#00D4FF",
  documents: "#9D7CD8",
  data: "#22C55E",
  social: "#F97316",
  custom: "#6366F1",
};

// ─── Tree builder ───

function buildHierarchy(agents: HierarchyAgent[]): {
  roots: HierarchyNode[];
  unassigned: HierarchyAgent[];
} {
  const agentMap = new Map<string, HierarchyAgent>();
  const childrenMap = new Map<string, HierarchyAgent[]>();

  for (const agent of agents) {
    agentMap.set(agent.id, agent);
  }
  for (const agent of agents) {
    if (agent.parentAgentId && agentMap.has(agent.parentAgentId)) {
      const list = childrenMap.get(agent.parentAgentId) || [];
      list.push(agent);
      childrenMap.set(agent.parentAgentId, list);
    }
  }

  function buildNode(agent: HierarchyAgent): HierarchyNode {
    const children = (childrenMap.get(agent.id) || []).map(buildNode);
    return { agent, children };
  }

  const roots: HierarchyNode[] = [];
  const unassigned: HierarchyAgent[] = [];

  for (const agent of agents) {
    const hasValidParent =
      agent.parentAgentId && agentMap.has(agent.parentAgentId);
    if (hasValidParent) continue;

    if (agent.role) {
      roots.push(buildNode(agent));
    } else {
      unassigned.push(agent);
    }
  }

  return { roots, unassigned };
}

// ─── Cycle detection ───

function isDescendantOf(
  agentId: string,
  potentialAncestorId: string,
  agents: HierarchyAgent[]
): boolean {
  const childrenMap = new Map<string, string[]>();
  for (const a of agents) {
    if (a.parentAgentId) {
      const list = childrenMap.get(a.parentAgentId) || [];
      list.push(a.id);
      childrenMap.set(a.parentAgentId, list);
    }
  }
  const visited = new Set<string>();
  const queue = [potentialAncestorId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === agentId) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    queue.push(...(childrenMap.get(current) || []));
  }
  return false;
}

// ─── Main Component ───

export default function HierarchyPage() {
  const { data: agents, isLoading } = useSWR<HierarchyAgent[]>(
    "/api/hierarchy",
    fetcher
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const { roots, unassigned } = useMemo(
    () => (agents ? buildHierarchy(agents) : { roots: [], unassigned: [] }),
    [agents]
  );

  const toggleCollapse = useCallback((id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // ─── Agent patching ───

  const patchAgent = useCallback(
    async (
      childId: string,
      updates: { parentAgentId?: string | null; role?: string | null }
    ) => {
      setSaving(true);
      try {
        const res = await apiFetch(`/api/agents/${childId}`, {
          method: "PATCH",
          body: JSON.stringify(updates),
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

  // ─── Drag handlers ───

  const drag = useMemo<DragHandlers>(
    () => ({
      onDragStart(e: React.DragEvent, id: string) {
        e.dataTransfer.setData("agentId", id);
        e.dataTransfer.effectAllowed = "move";
        setDraggingId(id);
      },
      onDragEnd() {
        setDraggingId(null);
        setDragOverId(null);
      },
      onDragOver(e: React.DragEvent, id: string) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setDragOverId(id);
      },
      onDragLeave() {
        setDragOverId(null);
      },
      onDrop(e: React.DragEvent, targetParentId: string | null) {
        e.preventDefault();
        e.stopPropagation();
        setDragOverId(null);
        const childId = e.dataTransfer.getData("agentId");
        if (!childId || childId === targetParentId) return;

        if (
          targetParentId &&
          agents &&
          isDescendantOf(targetParentId, childId, agents)
        ) {
          toast.error("Cannot create circular hierarchy");
          return;
        }

        const child = agents?.find((a) => a.id === childId);
        if (!child) return;

        if (targetParentId === null) {
          const updates: { parentAgentId: null; role?: string } = {
            parentAgentId: null,
          };
          if (!child.role) {
            updates.role = child.description || "Agent";
          }
          patchAgent(childId, updates);
        } else {
          const updates: { parentAgentId: string; role?: string } = {
            parentAgentId: targetParentId,
          };
          if (!child.role) {
            updates.role = child.description || "Agent";
          }
          patchAgent(childId, updates);
        }
      },
    }),
    [patchAgent, agents]
  );

  const handleRemoveFromHierarchy = useCallback(
    (agentId: string) => {
      patchAgent(agentId, { parentAgentId: null, role: null });
    },
    [patchAgent]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!agents || agents.length === 0) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <GitBranch className="w-5 h-5 text-primary" />
              Agent Hierarchy
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Organize your agents in a visual hierarchy
            </p>
          </div>
        </div>
        <div className="text-center py-16">
          <Bot className="w-12 h-12 mx-auto text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-medium mb-2">No agents yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Create agents and organize them into a hierarchy
          </p>
          <Link
            href="/agents/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Create Agent
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
            Organization
          </div>
          <h1 className="text-xl font-semibold text-foreground">
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

      {/* Org chart */}
      <div className="overflow-x-auto pb-4">
        <div className="inline-flex flex-col items-center min-w-full">
          {/* CEO / You card */}
          <div
            className={`rounded-xl border-2 bg-card px-6 py-3 transition-colors ${
              dragOverId === "__ceo__"
                ? "border-primary/60 bg-primary/5"
                : "border-border"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              setDragOverId("__ceo__");
            }}
            onDragLeave={() => setDragOverId(null)}
            onDrop={(e) => {
              setDragOverId(null);
              drag.onDrop(e, null);
            }}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
                <User className="w-4 h-4 text-primary" />
              </div>
              <div className="text-left">
                <div className="font-semibold text-sm text-foreground">You</div>
                <div className="text-xs text-muted-foreground">
                  Workspace Owner
                </div>
              </div>
            </div>
          </div>

          {/* Connector from CEO to first level */}
          {roots.length > 0 && <VerticalLine />}

          {/* First level: root agents */}
          {roots.length > 0 && (
            <TreeChildren
              nodes={roots}
              selectedId={selectedId}
              setSelectedId={setSelectedId}
              dragOverId={dragOverId}
              draggingId={draggingId}
              collapsedIds={collapsedIds}
              toggleCollapse={toggleCollapse}
              drag={drag}
              onRemove={handleRemoveFromHierarchy}
            />
          )}
        </div>
      </div>

      {/* Unassigned pool */}
      {unassigned.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">
            Unassigned agents — drag them into the hierarchy above
          </h3>
          <div className="flex flex-wrap gap-3">
            {unassigned.map((agent) => {
              const color =
                typeColors[agent.type || "general"] || typeColors.general;
              return (
                <div
                  key={agent.id}
                  draggable
                  onDragStart={(e) => drag.onDragStart(e, agent.id)}
                  onDragEnd={drag.onDragEnd}
                  className={`cursor-grab active:cursor-grabbing select-none rounded-lg border border-dashed bg-card/50 px-3 py-2 flex items-center gap-2 transition-all min-w-[160px] ${
                    draggingId === agent.id
                      ? "opacity-40 border-border"
                      : "border-border hover:border-muted-foreground/50"
                  }`}
                >
                  <GripVertical className="w-3 h-3 text-muted-foreground/40 shrink-0" />
                  <div
                    className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                    style={{ background: `${color}15` }}
                  >
                    <Bot className="w-3.5 h-3.5" style={{ color }} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-foreground truncate">
                      {agent.name}
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate">
                      {agent.description || "No role assigned"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Hint when all agents are unassigned */}
      {roots.length === 0 && unassigned.length > 0 && (
        <p className="text-center text-xs text-muted-foreground py-4">
          Assign roles to your agents or drag them onto the &quot;You&quot; card
          to add them to the hierarchy
        </p>
      )}
    </div>
  );
}

// ─── Tree Children (horizontal row of sibling nodes + connectors) ───

function TreeChildren({
  nodes,
  selectedId,
  setSelectedId,
  dragOverId,
  draggingId,
  collapsedIds,
  toggleCollapse,
  drag,
  onRemove,
}: {
  nodes: HierarchyNode[];
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  dragOverId: string | null;
  draggingId: string | null;
  collapsedIds: Set<string>;
  toggleCollapse: (id: string) => void;
  drag: DragHandlers;
  onRemove: (agentId: string) => void;
}) {
  if (nodes.length === 0) return null;

  return (
    <div className="flex items-start gap-0">
      {nodes.map((node, idx) => {
        const isCollapsed = collapsedIds.has(node.agent.id);
        return (
          <div key={node.agent.id} className="flex flex-col items-center">
            {/* Horizontal bar segment connecting siblings */}
            {nodes.length > 1 && (
              <div className="flex w-full">
                <div
                  className={`h-px flex-1 ${
                    idx === 0 ? "bg-transparent" : "bg-border"
                  }`}
                />
                <div
                  className={`h-px flex-1 ${
                    idx === nodes.length - 1 ? "bg-transparent" : "bg-border"
                  }`}
                />
              </div>
            )}
            {nodes.length > 1 && <VerticalLine />}

            {/* Card */}
            <div className="px-3">
              <NodeCard
                node={node}
                isSelected={selectedId === node.agent.id}
                isDragOver={dragOverId === node.agent.id}
                isDragging={draggingId === node.agent.id}
                isCollapsed={isCollapsed}
                onSelect={() =>
                  setSelectedId(
                    selectedId === node.agent.id ? null : node.agent.id
                  )
                }
                onToggleCollapse={
                  node.children.length > 0
                    ? () => toggleCollapse(node.agent.id)
                    : undefined
                }
                onRemove={() => onRemove(node.agent.id)}
                drag={drag}
              />
            </div>

            {/* Recursive children */}
            {node.children.length > 0 && !isCollapsed && (
              <>
                <VerticalLine />
                <TreeChildren
                  nodes={node.children}
                  selectedId={selectedId}
                  setSelectedId={setSelectedId}
                  dragOverId={dragOverId}
                  draggingId={draggingId}
                  collapsedIds={collapsedIds}
                  toggleCollapse={toggleCollapse}
                  drag={drag}
                  onRemove={onRemove}
                />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Vertical connector line ───

function VerticalLine() {
  return <div className="w-px h-7 bg-border shrink-0" />;
}

// ─── Node Card ───

function NodeCard({
  node,
  isSelected,
  isDragOver,
  isDragging,
  isCollapsed,
  onSelect,
  onToggleCollapse,
  onRemove,
  drag,
}: {
  node: HierarchyNode;
  isSelected: boolean;
  isDragOver: boolean;
  isDragging: boolean;
  isCollapsed: boolean;
  onSelect: () => void;
  onToggleCollapse?: () => void;
  onRemove: () => void;
  drag: DragHandlers;
}) {
  const { agent } = node;
  const color = typeColors[agent.type || "general"] || typeColors.general;
  const isActive = agent.isActive ?? true;
  const completed = agent.totalTasksCompleted || 0;
  const failed = agent.totalTasksFailed || 0;

  return (
    <div
      draggable
      onDragStart={(e) => drag.onDragStart(e, agent.id)}
      onDragEnd={drag.onDragEnd}
      onDragOver={(e) => drag.onDragOver(e, agent.id)}
      onDragLeave={drag.onDragLeave}
      onDrop={(e) => drag.onDrop(e, agent.id)}
      onClick={onSelect}
      className={`
        group relative cursor-grab active:cursor-grabbing select-none
        rounded-xl border-2 bg-card
        px-4 py-3 w-[220px]
        transition-all duration-150
        ${isDragging ? "opacity-40 scale-95" : ""}
        ${
          isSelected
            ? "border-primary shadow-[0_0_24px_rgba(124,58,237,0.12)]"
            : isDragOver
              ? "border-primary/60 bg-primary/5"
              : "border-border hover:border-border/60"
        }
      `}
    >
      {/* Active indicator */}
      <div
        className={`absolute top-2.5 right-2.5 w-2 h-2 rounded-full ${
          isActive ? "bg-green-500" : "bg-red-500"
        }`}
      />

      {/* Remove from hierarchy */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="absolute top-2.5 right-7 w-3.5 h-3.5 text-muted-foreground/0 hover:text-red-400 transition-colors group-hover:text-muted-foreground/40"
        title="Remove from hierarchy"
      >
        <XCircle className="w-3.5 h-3.5" />
      </button>

      {/* Icon + name + role */}
      <div className="flex items-center gap-3 mb-1.5">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: `${color}20` }}
        >
          <Bot className="w-[18px] h-[18px]" style={{ color }} />
        </div>
        <div className="min-w-0 flex-1">
          <Link
            href={`/agents/${agent.id}`}
            onClick={(e) => e.stopPropagation()}
            className="font-semibold text-sm text-foreground truncate block hover:text-primary transition-colors"
          >
            {agent.name}
          </Link>
          <div className="text-[11px] text-muted-foreground truncate leading-tight">
            {agent.role || agent.description || "No role assigned"}
          </div>
        </div>
      </div>

      {/* Stats row */}
      {(completed > 0 || failed > 0) && (
        <div className="flex items-center gap-3 mt-2 pt-2 border-t border-border/30 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-green-500" />
            {completed} completed
          </span>
          <span className="flex items-center gap-1">
            <XCircle className="w-3 h-3 text-red-500" />
            {failed} failed
          </span>
        </div>
      )}

      {/* Model badge */}
      {agent.model && (
        <div className="mt-1.5 text-[9px] font-medium text-muted-foreground/60 uppercase tracking-wider">
          {agent.model}
        </div>
      )}

      {/* Edit shortcut */}
      <Link
        href={`/agents/${agent.id}/edit`}
        onClick={(e) => e.stopPropagation()}
        className="absolute bottom-2.5 right-2.5 w-5 h-5 rounded-md flex items-center justify-center text-muted-foreground/0 group-hover:text-muted-foreground/50 hover:!text-foreground hover:bg-muted transition-all"
        title="Edit agent"
      >
        <Settings className="w-3 h-3" />
      </Link>

      {/* Collapse toggle */}
      {onToggleCollapse && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleCollapse();
          }}
          className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-card border border-border flex items-center justify-center hover:bg-muted transition-colors z-10"
        >
          {isCollapsed ? (
            <ChevronRight className="w-3 h-3 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-3 h-3 text-muted-foreground" />
          )}
        </button>
      )}

      {/* Collapsed child count */}
      {onToggleCollapse && isCollapsed && (
        <div className="absolute -bottom-3 left-1/2 translate-x-2 text-[9px] text-muted-foreground font-medium">
          {node.children.length}
        </div>
      )}
    </div>
  );
}
