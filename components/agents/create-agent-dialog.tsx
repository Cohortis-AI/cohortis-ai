"use client";

import {
  useState,
  useCallback,
  useEffect,
  useRef,
  type DragEvent,
} from "react";
import { mutate } from "swr";
import { toast } from "sonner";
import {
  Bot,
  Mail,
  Calendar,
  FileText,
  FilePlus2,
  BarChart3,
  Share2,
  X,
  Loader2,
  Zap,
  Search,
  Upload,
  Plus,
  Pencil,
  Trash2,
  FileUp,
  MessageCircle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { SkillCreatorDialog } from "@/components/agents/skill-creator-dialog";
import { apiFetch } from "@/lib/api-client";
import type { AgentData, CustomSkill, KnowledgeFile } from "@/lib/agents/types";

// ─── Types ───

interface AgentFormData {
  name: string;
  description: string;
  type: string;
  systemPrompt: string;
  model: string;
  capabilities: string[];
  role: string;
  parentAgentId: string;
  customSkills: CustomSkill[];
  knowledgeFiles: KnowledgeFile[];
  conversationStarters: string[];
}

const defaultFormData: AgentFormData = {
  name: "",
  description: "",
  type: "general",
  systemPrompt: "",
  model: "gpt-5.2",
  capabilities: [],
  role: "",
  parentAgentId: "",
  customSkills: [],
  knowledgeFiles: [],
  conversationStarters: [],
};

// ─── Constants ───

const agentTypes = [
  { value: "general", label: "General", icon: Bot, color: "#7C3AED" },
  { value: "email", label: "Email", icon: Mail, color: "#F59E0B" },
  { value: "calendar", label: "Calendar", icon: Calendar, color: "#00D4FF" },
  {
    value: "documents",
    label: "Documents",
    icon: FileText,
    color: "#9D7CD8",
  },
  { value: "data", label: "Data", icon: BarChart3, color: "#22C55E" },
  { value: "social", label: "Social", icon: Share2, color: "#F97316" },
];

const modelOptions = [
  { value: "gpt-5.2", label: "GPT-5.2", provider: "openai" },
  {
    value: "claude-opus-4-6",
    label: "Claude Opus 4.6",
    provider: "anthropic",
  },
  {
    value: "claude-sonnet-4-6",
    label: "Claude Sonnet 4.6",
    provider: "anthropic",
  },
  { value: "gpt-4o-mini", label: "GPT-4o Mini", provider: "openai" },
];

interface AgentTemplate {
  name: string;
  description: string;
  type: string;
  systemPrompt: string;
  capabilities: string[];
  role: string;
  icon: typeof Bot;
  conversationStarters?: string[];
}

const templates: AgentTemplate[] = [
  {
    name: "Web Researcher",
    description: "Navigates websites, extracts data, and gathers information",
    type: "general",
    systemPrompt:
      "You are a web research specialist. Use your browser to navigate websites, extract data, fill forms, and gather information.",
    capabilities: ["browser-use"],
    role: "Web Research Analyst",
    icon: Search,
  },
  {
    name: "Email Manager",
    description: "Triages emails, drafts responses, organizes inbox",
    type: "email",
    systemPrompt:
      "You are an email management specialist. Triage emails, draft responses, and organize the inbox efficiently.",
    capabilities: ["email-assistant", "email-composer"],
    role: "Email Director",
    icon: Mail,
  },
  {
    name: "Scheduler",
    description: "Manages calendar, schedules meetings, handles availability",
    type: "calendar",
    systemPrompt:
      "You are a scheduling assistant. Manage calendar events, schedule meetings, and handle availability.",
    capabilities: ["calendar-skills", "meeting-scheduler"],
    role: "Scheduling Coordinator",
    icon: Calendar,
  },
  {
    name: "Document Generator",
    description: "Creates Word, PDF, and Excel documents on demand",
    type: "documents",
    systemPrompt:
      "You are a professional document generator. Create high-quality, well-structured documents based on user requirements.",
    capabilities: ["docx-generator", "pdf-processor", "xlsx-builder"],
    role: "Document Creation Specialist",
    icon: FilePlus2,
    conversationStarters: [
      "Create a project proposal document",
      "Generate a monthly report template",
      "Build a budget spreadsheet",
    ],
  },
  {
    name: "Data Analyst",
    description: "Analyzes datasets, generates reports, identifies trends",
    type: "data",
    systemPrompt:
      "You are a data analysis specialist. Analyze datasets, generate reports, and identify trends.",
    capabilities: ["data-analyst", "csv-processor"],
    role: "Senior Data Analyst",
    icon: BarChart3,
  },
];

// ─── Component ───

interface CreateAgentDialogProps {
  open: boolean;
  onClose: () => void;
  editAgent?: AgentData | null;
  agents?: AgentData[];
}

export function CreateAgentDialog({
  open,
  onClose,
  editAgent,
  agents = [],
}: CreateAgentDialogProps) {
  const isEditing = !!editAgent;

  const [form, setForm] = useState<AgentFormData>({ ...defaultFormData });
  const [saving, setSaving] = useState(false);
  const [skillCreatorOpen, setSkillCreatorOpen] = useState(false);
  const [editingCustomSkill, setEditingCustomSkill] =
    useState<CustomSkill | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [starterInput, setStarterInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  // Sync form when editAgent changes
  useEffect(() => {
    if (editAgent) {
      setForm({
        name: editAgent.name,
        description: editAgent.description || "",
        type: editAgent.type || "general",
        systemPrompt: editAgent.systemPrompt || "",
        model: editAgent.model || "gpt-5.2",
        capabilities: editAgent.capabilities || [],
        role: editAgent.role || "",
        parentAgentId: editAgent.parentAgentId || "",
        customSkills: editAgent.customSkills || [],
        knowledgeFiles: editAgent.knowledgeFiles || [],
        conversationStarters: editAgent.conversationStarters || [],
      });
    } else {
      setForm({ ...defaultFormData });
    }
    setStarterInput("");
  }, [editAgent, open]);

  const applyTemplate = (template: AgentTemplate) => {
    setForm((prev) => ({
      ...prev,
      name: template.name,
      description: template.description,
      type: template.type,
      systemPrompt: template.systemPrompt,
      capabilities: [...template.capabilities],
      role: template.role,
      conversationStarters:
        template.conversationStarters || prev.conversationStarters,
    }));
  };

  // Parent agent options (exclude self)
  const parentOptions = agents.filter(
    (a) => !editAgent || a.id !== editAgent.id
  );

  // ─── File handling ───

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };
  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    processFiles(Array.from(e.dataTransfer.files));
  };

  const processFiles = async (files: File[]) => {
    for (const file of files) {
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (ext === "json" || ext === "skills") {
        try {
          const text = await file.text();
          const parsed = JSON.parse(text);
          const skills: CustomSkill[] = Array.isArray(parsed)
            ? parsed
            : [parsed];
          for (const raw of skills) {
            if (raw.name && raw.instructions) {
              const skill: CustomSkill = {
                id:
                  raw.id ||
                  `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                name: raw.name,
                description: raw.description || "",
                instructions: raw.instructions,
                category: raw.category || "Custom",
              };
              setForm((prev) => ({
                ...prev,
                customSkills: [
                  ...prev.customSkills.filter((s) => s.id !== skill.id),
                  skill,
                ],
                capabilities: [...new Set([...prev.capabilities, skill.id])],
              }));
            }
          }
        } catch {
          toast.error(`Failed to parse ${file.name}`);
        }
      } else if (ext === "md" || ext === "txt") {
        const text = await file.text();
        const kf: KnowledgeFile = {
          id: `kf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: file.name,
          content: text,
          addedAt: new Date().toISOString(),
        };
        setForm((prev) => ({
          ...prev,
          knowledgeFiles: [...prev.knowledgeFiles, kf],
        }));
      }
    }
  };

  // ─── Custom Skills ───

  const handleCustomSkillCreated = (skill: CustomSkill) => {
    setForm((prev) => {
      const existing = prev.customSkills.findIndex((s) => s.id === skill.id);
      const updatedSkills =
        existing >= 0
          ? prev.customSkills.map((s) => (s.id === skill.id ? skill : s))
          : [...prev.customSkills, skill];
      return {
        ...prev,
        customSkills: updatedSkills,
        capabilities: [...new Set([...prev.capabilities, skill.id])],
      };
    });
    setEditingCustomSkill(null);
  };

  // ─── Save ───

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);

    const selectedModel = modelOptions.find((m) => m.value === form.model);
    const payload = {
      name: form.name.trim(),
      description: form.description || null,
      type: form.type,
      systemPrompt: form.systemPrompt || null,
      model: form.model,
      provider: selectedModel?.provider || "openai",
      capabilities: form.capabilities,
      role: form.role || null,
      parentAgentId: form.parentAgentId || null,
      customSkills: form.customSkills.length > 0 ? form.customSkills : null,
      knowledgeFiles:
        form.knowledgeFiles.length > 0 ? form.knowledgeFiles : null,
      conversationStarters:
        form.conversationStarters.length > 0
          ? form.conversationStarters
          : null,
    };

    try {
      if (isEditing && editAgent) {
        const res = await apiFetch(`/api/agents/${editAgent.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Failed");
        toast.success("Agent updated");
      } else {
        const res = await apiFetch("/api/agents", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Failed");
        toast.success("Agent created");
      }
      await mutate("/api/agents");
      await mutate("/api/hierarchy");
      onClose();
    } catch {
      toast.error("Failed to save agent");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-[60] flex items-center justify-center">
        <div
          ref={backdropRef}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />
        <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4">
          {/* Header */}
          <div className="sticky top-0 bg-card border-b border-border px-6 py-4 rounded-t-2xl z-10">
            <h2 className="text-base font-semibold">
              {isEditing ? `Edit ${editAgent?.name}` : "Create Agent"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {isEditing
                ? "Update agent configuration"
                : "Define your agent's identity and capabilities"}
            </p>
          </div>

          <div className="px-6 py-4 space-y-5">
            {/* Templates (create only) */}
            {!isEditing && (
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-2">
                  Quick start template
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {templates.map((tmpl) => (
                    <button
                      key={tmpl.name}
                      type="button"
                      onClick={() => applyTemplate(tmpl)}
                      className="flex flex-col items-center gap-1 px-3 py-2.5 rounded-lg border border-border bg-card hover:border-primary/30 text-xs transition-colors"
                    >
                      <tmpl.icon className="w-4 h-4 text-primary" />
                      <span className="font-medium">{tmpl.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Name */}
            <div>
              <label className="block text-sm font-medium mb-1.5">Name</label>
              <input
                type="text"
                placeholder="e.g., Sales Outreach Agent"
                value={form.name}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, name: e.target.value }))
                }
                className="w-full px-3 py-2 rounded-lg bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>

            {/* Role */}
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Role{" "}
                <span className="text-muted-foreground font-normal">
                  (organizational title)
                </span>
              </label>
              <input
                type="text"
                placeholder="e.g., Head of Outreach"
                value={form.role}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, role: e.target.value }))
                }
                className="w-full px-3 py-2 rounded-lg bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Defines the agent&apos;s position in the hierarchy
              </p>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Description
              </label>
              <textarea
                placeholder="What does this agent do?"
                rows={2}
                value={form.description}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 rounded-lg bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
              />
            </div>

            {/* Type + Model row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Type
                </label>
                <select
                  value={form.type}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, type: e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded-lg bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  {agentTypes.map((at) => (
                    <option key={at.value} value={at.value}>
                      {at.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Model
                </label>
                <select
                  value={form.model}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, model: e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded-lg bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  {modelOptions.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Reports To */}
            {parentOptions.length > 0 && (
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Reports To
                </label>
                <select
                  value={form.parentAgentId || "none"}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      parentAgentId: e.target.value === "none" ? "" : e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 rounded-lg bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="none">No parent (root agent)</option>
                  {parentOptions.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  This agent will appear as a sub-agent in the hierarchy
                </p>
              </div>
            )}

            {/* System Prompt */}
            <div>
              <label className="block text-sm font-medium mb-1.5">
                System Prompt
              </label>
              <textarea
                placeholder="You are a specialized agent that..."
                rows={5}
                value={form.systemPrompt}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    systemPrompt: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 rounded-lg bg-input border border-border text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
              />
            </div>

            {/* Knowledge & Skill Files Drop Zone */}
            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium mb-1.5">
                <FileUp className="w-4 h-4 text-primary" />
                Knowledge & Skill Files
              </label>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                  isDragging
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/50 hover:bg-secondary/30"
                }`}
              >
                <Upload
                  className={`w-5 h-5 mx-auto mb-1.5 ${isDragging ? "text-primary" : "text-muted-foreground/50"}`}
                />
                <p className="text-sm text-muted-foreground">
                  Drop <code>.md</code> / <code>.txt</code> (knowledge) or{" "}
                  <code>.json</code> / <code>.skills</code> (custom skills)
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  or click to browse
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".md,.txt,.skills,.json"
                  multiple
                  onChange={(e) =>
                    processFiles(Array.from(e.target.files || []))
                  }
                />
              </div>

              {/* Uploaded knowledge files */}
              {form.knowledgeFiles.length > 0 && (
                <div className="space-y-1.5 mt-2">
                  {form.knowledgeFiles.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between px-3 py-2 bg-secondary/30 border border-border rounded-md text-sm"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span className="truncate font-medium">
                          {file.name}
                        </span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {(file.content.length / 1024).toFixed(1)}KB
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setForm((prev) => ({
                            ...prev,
                            knowledgeFiles: prev.knowledgeFiles.filter(
                              (f) => f.id !== file.id
                            ),
                          }))
                        }
                        className="ml-2 text-muted-foreground hover:text-red-400 shrink-0"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Conversation Starters */}
            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium mb-1.5">
                <MessageCircle className="w-4 h-4 text-primary" />
                Conversation Starters
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g., What's on my calendar today?"
                  value={starterInput}
                  onChange={(e) => setStarterInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const trimmed = starterInput.trim();
                      if (trimmed) {
                        setForm((prev) => ({
                          ...prev,
                          conversationStarters: [
                            ...prev.conversationStarters,
                            trimmed,
                          ],
                        }));
                        setStarterInput("");
                      }
                    }
                  }}
                  className="flex-1 px-3 py-2 rounded-lg bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <button
                  type="button"
                  onClick={() => {
                    const trimmed = starterInput.trim();
                    if (trimmed) {
                      setForm((prev) => ({
                        ...prev,
                        conversationStarters: [
                          ...prev.conversationStarters,
                          trimmed,
                        ],
                      }));
                      setStarterInput("");
                    }
                  }}
                  disabled={!starterInput.trim()}
                  className="px-3 py-2 rounded-lg border border-border text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              {form.conversationStarters.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {form.conversationStarters.map((starter, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-secondary text-xs max-w-[250px]"
                    >
                      <span className="truncate">{starter}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setForm((prev) => ({
                            ...prev,
                            conversationStarters:
                              prev.conversationStarters.filter(
                                (_, i) => i !== idx
                              ),
                          }))
                        }
                        className="ml-0.5 text-muted-foreground hover:text-red-400"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Suggested prompts shown when the chat is empty
              </p>
            </div>

            {/* Custom Skills */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="flex items-center gap-1.5 text-sm font-medium">
                  <Zap className="w-4 h-4 text-primary" />
                  Custom Skills
                </label>
                <span className="text-xs text-muted-foreground">
                  {form.customSkills.length} equipped
                </span>
              </div>

              {/* Custom skills list */}
              {form.customSkills.length > 0 && (
                <div className="space-y-1.5 mb-2">
                  {form.customSkills.map((skill) => (
                    <div
                      key={skill.id}
                      className="flex items-center justify-between px-3 py-2 bg-primary/5 border border-primary/20 rounded-md text-sm"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Zap className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span className="truncate font-medium text-primary">
                          {skill.name}
                        </span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {skill.category || "Custom"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCustomSkill(skill);
                            setSkillCreatorOpen(true);
                          }}
                          className="p-1 text-muted-foreground hover:text-foreground"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setForm((prev) => ({
                              ...prev,
                              customSkills: prev.customSkills.filter(
                                (s) => s.id !== skill.id
                              ),
                              capabilities: prev.capabilities.filter(
                                (c) => c !== skill.id
                              ),
                            }))
                          }
                          className="p-1 text-muted-foreground hover:text-red-400"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  setEditingCustomSkill(null);
                  setSkillCreatorOpen(true);
                }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-dashed border-primary/30 text-xs text-primary hover:bg-primary/5 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Create Custom Skill
              </button>
            </div>

            {/* Active toggle (edit only) */}
            {isEditing && (
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium">Active</p>
                  <p className="text-xs text-muted-foreground">
                    Paused agents won&apos;t receive delegated tasks
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    // Toggle via API
                    apiFetch(`/api/agents/${editAgent!.id}`, {
                      method: "PATCH",
                      body: JSON.stringify({
                        isActive: !(editAgent!.isActive ?? true),
                      }),
                    }).then(() => mutate("/api/agents"));
                  }}
                  className={`w-10 h-6 rounded-full transition-colors ${
                    editAgent?.isActive ?? true ? "bg-primary" : "bg-secondary"
                  }`}
                >
                  <span
                    className={`block w-4 h-4 rounded-full bg-white transition-transform mx-1 ${
                      editAgent?.isActive ?? true ? "translate-x-4" : ""
                    }`}
                  />
                </button>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-card border-t border-border px-6 py-3 rounded-b-2xl flex items-center justify-between">
            {isEditing && editAgent && (
              <button
                type="button"
                onClick={async () => {
                  if (
                    !confirm(
                      "Are you sure you want to delete this agent? This cannot be undone."
                    )
                  )
                    return;
                  const res = await apiFetch(`/api/agents/${editAgent.id}`, {
                    method: "DELETE",
                  });
                  if (res.ok) {
                    toast.success("Agent deleted");
                    mutate("/api/agents");
                    mutate("/api/hierarchy");
                    onClose();
                  } else {
                    toast.error("Failed to delete agent");
                  }
                }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            )}
            <div
              className={`flex gap-3 ${isEditing ? "" : "ml-auto"}`}
            >
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !form.name.trim()}
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {isEditing ? "Save" : "Create Agent"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Skill Creator Dialog */}
      <SkillCreatorDialog
        open={skillCreatorOpen}
        onClose={() => {
          setSkillCreatorOpen(false);
          setEditingCustomSkill(null);
        }}
        onSkillCreated={handleCustomSkillCreated}
        editSkill={editingCustomSkill}
      />
    </>
  );
}
