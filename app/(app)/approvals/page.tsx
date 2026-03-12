"use client";

import { useState } from "react";
import useSWR, { mutate } from "swr";
import { toast } from "sonner";
import {
  ShieldCheck,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Bot,
  AlertTriangle,
  DollarSign,
  GitBranch,
  Zap,
  Globe,
  Filter,
} from "lucide-react";
import { fetcher, apiFetch } from "@/lib/api-client";

interface Approval {
  id: string;
  agentId: string;
  runId: string | null;
  action: string;
  actionType: string;
  status: "pending" | "approved" | "rejected";
  requestedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  reviewNote: string | null;
  metadata: unknown;
  createdAt: string;
}

interface AgentBasic {
  id: string;
  name: string;
  type: string | null;
}

const actionTypeIcons: Record<string, typeof AlertTriangle> = {
  budget_override: DollarSign,
  prompt_change: GitBranch,
  delegation: Bot,
  external_action: Globe,
  high_cost: AlertTriangle,
};

const actionTypeColors: Record<string, string> = {
  budget_override: "text-amber-400",
  prompt_change: "text-blue-400",
  delegation: "text-primary",
  external_action: "text-cyan-400",
  high_cost: "text-red-400",
};

const statusConfig: Record<
  string,
  { label: string; icon: typeof Clock; color: string; bg: string }
> = {
  pending: {
    label: "Pending",
    icon: Clock,
    color: "text-amber-400",
    bg: "bg-amber-400/10",
  },
  approved: {
    label: "Approved",
    icon: CheckCircle2,
    color: "text-green-400",
    bg: "bg-green-400/10",
  },
  rejected: {
    label: "Rejected",
    icon: XCircle,
    color: "text-red-400",
    bg: "bg-red-400/10",
  },
};

export default function ApprovalsPage() {
  const { data: approvals = [], isLoading } = useSWR<Approval[]>(
    "/api/approvals",
    fetcher,
    { refreshInterval: 5000 }
  );
  const { data: agents = [] } = useSWR<AgentBasic[]>("/api/agents", fetcher);

  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">(
    "all"
  );

  const filtered =
    filter === "all"
      ? approvals
      : approvals.filter((a) => a.status === filter);

  const pendingCount = approvals.filter((a) => a.status === "pending").length;
  const approvedCount = approvals.filter((a) => a.status === "approved").length;
  const rejectedCount = approvals.filter((a) => a.status === "rejected").length;

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Approvals</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Review and approve agent actions before execution
          </p>
        </div>
        {pendingCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-400/10 text-amber-400 text-sm font-medium">
            <Clock className="w-4 h-4" />
            {pendingCount} pending
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-amber-400/10 flex items-center justify-center">
            <Clock className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <div className="text-2xl font-semibold">{pendingCount}</div>
            <div className="text-sm text-muted-foreground">Pending</div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-green-400/10 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <div className="text-2xl font-semibold">{approvedCount}</div>
            <div className="text-sm text-muted-foreground">Approved</div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-red-400/10 flex items-center justify-center">
            <XCircle className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <div className="text-2xl font-semibold">{rejectedCount}</div>
            <div className="text-sm text-muted-foreground">Rejected</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-1 border-b border-border">
        {(
          [
            { value: "all", label: "All" },
            { value: "pending", label: "Pending" },
            { value: "approved", label: "Approved" },
            { value: "rejected", label: "Rejected" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              filter === tab.value
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
            {tab.value === "pending" && pendingCount > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-amber-400/20 text-amber-400 text-xs">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Approvals list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <ShieldCheck className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-1">
            {filter === "all"
              ? "No approvals yet"
              : `No ${filter} approvals`}
          </h3>
          <p className="text-muted-foreground">
            {filter === "pending"
              ? "All caught up — no actions waiting for review"
              : "Approval requests will appear here when agents need authorization"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((approval) => {
            const agent = agents.find((a) => a.id === approval.agentId);
            return (
              <ApprovalCard
                key={approval.id}
                approval={approval}
                agentName={agent?.name || "Unknown"}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Approval Card ───

function ApprovalCard({
  approval,
  agentName,
}: {
  approval: Approval;
  agentName: string;
}) {
  const [reviewing, setReviewing] = useState(false);
  const [note, setNote] = useState("");

  const status = statusConfig[approval.status] || statusConfig.pending;
  const StatusIcon = status.icon;
  const TypeIcon =
    actionTypeIcons[approval.actionType] || AlertTriangle;
  const typeColor =
    actionTypeColors[approval.actionType] || "text-muted-foreground";

  const handleReview = async (
    decision: "approved" | "rejected"
  ) => {
    setReviewing(true);
    try {
      await apiFetch(`/api/approvals/${approval.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: decision,
          reviewNote: note.trim() || null,
        }),
      });
      mutate("/api/approvals");
      toast.success(
        decision === "approved" ? "Approved" : "Rejected"
      );
    } catch {
      toast.error("Failed to review approval");
    } finally {
      setReviewing(false);
    }
  };

  return (
    <div
      className={`rounded-xl border bg-card p-4 ${
        approval.status === "pending"
          ? "border-amber-400/30"
          : "border-border"
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Type icon */}
        <div
          className={`w-9 h-9 rounded-lg ${status.bg} flex items-center justify-center shrink-0`}
        >
          <TypeIcon className={`w-4.5 h-4.5 ${typeColor}`} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
              <Bot className="w-3 h-3" />
              {agentName}
            </span>
            <span className="text-xs text-muted-foreground capitalize">
              {approval.actionType.replace(/_/g, " ")}
            </span>
            <div className="ml-auto flex items-center gap-1">
              <StatusIcon className={`w-3.5 h-3.5 ${status.color}`} />
              <span className={`text-xs font-medium ${status.color}`}>
                {status.label}
              </span>
            </div>
          </div>

          <p className="text-sm text-foreground">{approval.action}</p>

          <p className="text-xs text-muted-foreground mt-1">
            Requested{" "}
            {new Date(approval.requestedAt).toLocaleString()}
          </p>

          {approval.reviewNote && (
            <p className="text-xs text-muted-foreground mt-1 italic">
              Note: {approval.reviewNote}
            </p>
          )}
        </div>
      </div>

      {/* Pending actions */}
      {approval.status === "pending" && (
        <div className="mt-3 pt-3 border-t border-border flex items-center gap-2">
          <input
            type="text"
            placeholder="Optional note..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="flex-1 px-3 py-1.5 rounded-lg bg-input border border-border text-xs focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <button
            onClick={() => handleReview("approved")}
            disabled={reviewing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 text-xs font-medium hover:bg-green-500/20 transition-colors disabled:opacity-50"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Approve
          </button>
          <button
            onClick={() => handleReview("rejected")}
            disabled={reviewing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-xs font-medium hover:bg-red-500/20 transition-colors disabled:opacity-50"
          >
            <XCircle className="w-3.5 h-3.5" />
            Reject
          </button>
        </div>
      )}
    </div>
  );
}
