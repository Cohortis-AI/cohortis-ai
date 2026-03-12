"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  Zap,
  Eye,
  Code2,
  Sparkles,
  Loader2,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  Plus,
  X,
} from "lucide-react";
import type { CustomSkill } from "@/lib/agents/types";

interface SkillCreatorDialogProps {
  open: boolean;
  onClose: () => void;
  onSkillCreated: (skill: CustomSkill) => void;
  editSkill?: CustomSkill | null;
}

const SKILL_CATEGORIES = [
  "Productivity",
  "Communication",
  "Data & Analytics",
  "Browser Automation",
  "AI & LLMs",
  "DevOps & Cloud",
  "Web & Frontend",
  "Coding Agents",
  "Custom",
];

const SKILL_TEMPLATES: Record<
  string,
  { name: string; description: string; instructions: string }
> = {
  Productivity: {
    name: "Task Organizer",
    description:
      "Organizes tasks by priority, deadline, and project. Breaks down complex tasks into actionable steps.",
    instructions: `You are an expert task organizer. When the user gives you tasks or projects:

1. Break complex tasks into clear, actionable sub-tasks
2. Assign priority levels (urgent, high, medium, low) based on deadlines and impact
3. Group related tasks by project or theme
4. Suggest a realistic execution order considering dependencies
5. Flag any tasks that seem blocked or need clarification

Always output in a structured format with checkboxes. Be concise but thorough.`,
  },
  Communication: {
    name: "Email Composer",
    description:
      "Drafts professional emails adapted to context, tone, and audience.",
    instructions: `You are a skilled email writer. When drafting emails:

1. Match the tone to the context — formal for clients, friendly for colleagues
2. Start with a clear purpose statement
3. Keep paragraphs short (2-3 sentences max)
4. End with a specific call-to-action or next step
5. For replies, acknowledge the sender's points before adding your own

Avoid jargon unless the audience expects it. Prefer active voice.`,
  },
  "Data & Analytics": {
    name: "Data Analyzer",
    description:
      "Analyzes datasets, identifies patterns, and presents findings with clear summaries.",
    instructions: `You are a data analysis expert. When working with data:

1. Start with a high-level summary
2. Identify key trends, outliers, and correlations
3. Present numbers in context — percentages, comparisons, period-over-period changes
4. Suggest actionable insights, not just observations
5. Flag data quality issues before drawing conclusions

Format findings with clear headers and bullet points. Use tables for comparisons.`,
  },
};

const WRITING_TIPS = [
  {
    title: "Explain the why",
    tip: "Instead of rigid rules, explain reasoning. LLMs perform better when they understand the purpose.",
  },
  {
    title: "Use examples",
    tip: "Show input/output examples when the format matters. Concrete examples beat abstract descriptions.",
  },
  {
    title: "Keep it lean",
    tip: "Remove instructions that aren't pulling their weight. Every line should earn its place.",
  },
  {
    title: "Numbered steps",
    tip: "Break complex workflows into numbered steps. It helps the agent follow a consistent process.",
  },
  {
    title: "Think about edge cases",
    tip: "What happens with ambiguous input? Missing data? Add guidance for tricky scenarios.",
  },
];

export function SkillCreatorDialog({
  open,
  onClose,
  onSkillCreated,
  editSkill,
}: SkillCreatorDialogProps) {
  const [name, setName] = useState(editSkill?.name || "");
  const [description, setDescription] = useState(editSkill?.description || "");
  const [instructions, setInstructions] = useState(
    editSkill?.instructions || ""
  );
  const [category, setCategory] = useState(editSkill?.category || "Custom");
  const [testPrompts, setTestPrompts] = useState<string[]>(
    editSkill?.testPrompts || []
  );
  const [newTestPrompt, setNewTestPrompt] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [showTips, setShowTips] = useState(false);
  const [showTestPrompts, setShowTestPrompts] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);

  const isValid = name.trim() && description.trim() && instructions.trim();

  useEffect(() => {
    if (editSkill) {
      setName(editSkill.name);
      setDescription(editSkill.description);
      setInstructions(editSkill.instructions);
      setCategory(editSkill.category || "Custom");
      setTestPrompts(editSkill.testPrompts || []);
    } else if (open) {
      setName("");
      setDescription("");
      setInstructions("");
      setCategory("Custom");
      setTestPrompts([]);
    }
  }, [editSkill, open]);

  const generateSkillId = (skillName: string) =>
    skillName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

  const handleCategoryChange = (newCategory: string) => {
    setCategory(newCategory);
    const tmpl = SKILL_TEMPLATES[newCategory];
    if (tmpl && !name && !description && !instructions) {
      setName(tmpl.name);
      setDescription(tmpl.description);
      setInstructions(tmpl.instructions);
    }
  };

  const handleSave = () => {
    if (!isValid) return;
    const skill: CustomSkill = {
      id:
        editSkill?.id ||
        `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: name.trim(),
      description: description.trim(),
      instructions: instructions.trim(),
      category,
      ...(testPrompts.length > 0 ? { testPrompts } : {}),
    };
    onSkillCreated(skill);
    onClose();
  };

  const handleGenerate = useCallback(async () => {
    if (!description.trim()) return;
    setIsGenerating(true);
    try {
      const res = await fetch("/api/agents/generate-skill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: description.trim(),
          name: name.trim(),
        }),
      });
      if (!res.ok) throw new Error("Generation failed");
      const data = await res.json();
      if (data.instructions) {
        setInstructions(data.instructions);
      }
    } catch {
      // Silently fail
    } finally {
      setIsGenerating(false);
    }
  }, [description, name]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center">
      <div
        ref={backdropRef}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4">
        {/* Header */}
        <div className="sticky top-0 bg-card border-b border-border px-6 py-4 rounded-t-2xl z-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Zap className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-semibold">
                {editSkill ? "Edit Skill" : "Create Custom Skill"}
              </h2>
              <p className="text-xs text-muted-foreground">
                Define behavioral instructions for your agent
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Name + Category row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Name</label>
              <input
                type="text"
                placeholder='e.g., "Data Summarizer"'
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              {name && (
                <p className="text-xs text-muted-foreground mt-1">
                  ID:{" "}
                  <code className="text-primary">{generateSkillId(name)}</code>
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                {SKILL_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Description
            </label>
            <textarea
              placeholder="What does this skill do?"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
            />
          </div>

          {/* Instructions */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium">Instructions</label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={!description.trim() || isGenerating}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-primary hover:bg-primary/10 transition-colors disabled:opacity-40"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      AI Generate
                    </>
                  )}
                </button>
                <div className="w-px h-4 bg-border" />
                <button
                  type="button"
                  onClick={() => setShowPreview(!showPreview)}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPreview ? (
                    <>
                      <Code2 className="w-3.5 h-3.5" />
                      Edit
                    </>
                  ) : (
                    <>
                      <Eye className="w-3.5 h-3.5" />
                      Preview
                    </>
                  )}
                </button>
              </div>
            </div>

            {showPreview ? (
              <div className="border border-border rounded-lg p-4 bg-secondary/30 min-h-[200px]">
                <div className="text-xs text-muted-foreground mb-2 font-medium">
                  System prompt preview:
                </div>
                <pre className="text-sm whitespace-pre-wrap font-mono text-foreground/80">
                  {`<skill name="${name || "..."}" id="${generateSkillId(name || "skill")}">
${instructions || "..."}
</skill>`}
                </pre>
              </div>
            ) : (
              <textarea
                placeholder="Write detailed instructions that define this skill's behavior..."
                rows={10}
                className="w-full px-3 py-2 rounded-lg bg-input border border-border text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
              />
            )}
            <p className="text-xs text-muted-foreground mt-1">
              These instructions are injected into the agent&apos;s system
              prompt when this skill is equipped.
            </p>
          </div>

          {/* Writing Tips */}
          <button
            type="button"
            onClick={() => setShowTips(!showTips)}
            className="flex items-center gap-2 text-xs font-medium text-primary hover:text-primary/80 transition-colors w-full"
          >
            <Lightbulb className="w-3.5 h-3.5" />
            Writing tips
            {showTips ? (
              <ChevronUp className="w-3.5 h-3.5 ml-auto" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 ml-auto" />
            )}
          </button>

          {showTips && (
            <div className="space-y-2 p-3 border border-primary/20 rounded-lg bg-primary/5">
              {WRITING_TIPS.map((tip, i) => (
                <div key={i} className="flex gap-2">
                  <span className="text-primary font-bold text-xs mt-0.5 shrink-0">
                    {i + 1}.
                  </span>
                  <div>
                    <span className="text-xs font-medium text-foreground">
                      {tip.title}:{" "}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {tip.tip}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Test Prompts */}
          <button
            type="button"
            onClick={() => setShowTestPrompts(!showTestPrompts)}
            className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors w-full"
          >
            <Zap className="w-3.5 h-3.5" />
            Test prompts (optional)
            {testPrompts.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-secondary text-[10px] font-medium">
                {testPrompts.length}
              </span>
            )}
            {showTestPrompts ? (
              <ChevronUp className="w-3.5 h-3.5 ml-auto" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 ml-auto" />
            )}
          </button>

          {showTestPrompts && (
            <div className="space-y-2 p-3 border border-border rounded-lg">
              <p className="text-xs text-muted-foreground">
                Add example prompts that should trigger this skill.
              </p>
              {testPrompts.map((prompt, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 p-2 bg-secondary/30 rounded-md"
                >
                  <span className="text-xs text-muted-foreground mt-0.5 shrink-0">
                    {i + 1}.
                  </span>
                  <p className="text-xs text-foreground flex-1">{prompt}</p>
                  <button
                    type="button"
                    onClick={() =>
                      setTestPrompts(testPrompts.filter((_, idx) => idx !== i))
                    }
                    className="text-muted-foreground hover:text-red-400 shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g., Organize my tasks for this week"
                  value={newTestPrompt}
                  onChange={(e) => setNewTestPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const trimmed = newTestPrompt.trim();
                      if (trimmed) {
                        setTestPrompts([...testPrompts, trimmed]);
                        setNewTestPrompt("");
                      }
                    }
                  }}
                  className="flex-1 px-3 py-1.5 rounded-lg bg-input border border-border text-xs focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <button
                  type="button"
                  onClick={() => {
                    const trimmed = newTestPrompt.trim();
                    if (trimmed) {
                      setTestPrompts([...testPrompts, trimmed]);
                      setNewTestPrompt("");
                    }
                  }}
                  disabled={!newTestPrompt.trim()}
                  className="px-2 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Preview badge */}
          {name && (
            <div className="flex items-center gap-2 p-3 border border-border rounded-lg bg-secondary/20">
              <span className="text-xs text-muted-foreground">Preview:</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium border border-primary/20">
                <Zap className="w-3 h-3" />
                {name}
              </span>
              <span className="text-xs text-muted-foreground ml-auto">
                {category}
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-card border-t border-border px-6 py-3 rounded-b-2xl flex justify-end gap-3">
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
            disabled={!isValid}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <Zap className="w-4 h-4" />
            {editSkill ? "Save Changes" : "Create Skill"}
          </button>
        </div>
      </div>
    </div>
  );
}
