import {
  Bot,
  Mail,
  Calendar,
  FileText,
  BarChart3,
  Share2,
} from "lucide-react";

// ─── Agent Data ───

export interface AgentData {
  id: string;
  name: string;
  description: string | null;
  type: string | null;
  icon: string | null;
  role: string | null;
  parentAgentId: string | null;
  systemPrompt: string | null;
  capabilities: string[] | null;
  customSkills: CustomSkill[] | null;
  knowledgeFiles: KnowledgeFile[] | null;
  conversationStarters: string[] | null;
  promptHistory: Array<{
    previousPrompt: string | null;
    newPrompt: string;
    modifiedBy: string;
    reason: string;
    timestamp: string;
  }> | null;
  model: string | null;
  provider: string | null;
  runtime: string | null;
  webhookUrl: string | null;
  webhookSecret: string | null;
  webhookHeaders: Record<string, string> | null;
  isActive: boolean | null;
  lastActiveAt: string | null;
  totalTasksCompleted: number | null;
  totalTasksFailed: number | null;
  averageExecutionTime: number | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Custom Skills ───

export interface CustomSkill {
  id: string;
  name: string;
  description: string;
  instructions: string;
  category?: string;
  testPrompts?: string[];
}

// ─── Knowledge Files ───

export interface KnowledgeFile {
  id: string;
  name: string;
  content: string;
  addedAt: string;
}

// ─── Agent Type Visuals ───

export const typeIcons: Record<string, typeof Bot> = {
  general: Bot,
  email: Mail,
  calendar: Calendar,
  documents: FileText,
  data: BarChart3,
  social: Share2,
  custom: Bot,
};

export const typeColors: Record<string, string> = {
  general: "#7C3AED",
  email: "#F59E0B",
  calendar: "#00D4FF",
  documents: "#9D7CD8",
  data: "#22C55E",
  social: "#F97316",
  custom: "#6366F1",
};

// ─── Helpers ───

export function formatAvgTime(seconds: number | null): string {
  if (!seconds) return "--";
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

export function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const d = new Date(dateStr);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
