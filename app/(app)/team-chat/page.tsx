"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import useSWR from "swr";
import {
  Bot,
  Send,
  Loader2,
  Users,
  ChevronRight,
  Radio,
  CheckCircle2,
  XCircle,
  Zap,
  MessageSquare,
} from "lucide-react";
import { fetcher, apiFetch } from "@/lib/api-client";

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  agentResults?: Array<{
    agentName: string;
    agentType: string | null;
    status: string;
    durationMs?: number;
  }>;
}

interface DelegationEvent {
  agentName: string;
  agentId: string;
  task: string;
}

interface AgentResultEvent {
  agentName: string;
  agentType: string | null;
  status: string;
  durationMs?: number;
}

export default function TeamChatPage() {
  const { data: agents = [] } = useSWR("/api/agents", fetcher);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeDelegations, setActiveDelegations] = useState<DelegationEvent[]>(
    []
  );
  const [showRoster, setShowRoster] = useState(true);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const activeAgents = Array.isArray(agents)
    ? agents.filter((a: any) => a.isActive)
    : [];

  // Filtered agents for @mention suggestions
  const mentionSuggestions =
    mentionQuery !== null
      ? activeAgents.filter((a: any) =>
          a.name.toLowerCase().includes(mentionQuery.toLowerCase())
        )
      : [];

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, activeDelegations.length, isProcessing]);

  const insertMention = useCallback(
    (agentName: string) => {
      if (!inputRef.current) return;
      const textarea = inputRef.current;
      const cursorPos = textarea.selectionStart;
      const textBefore = input.slice(0, cursorPos);
      const textAfter = input.slice(cursorPos);

      // Find the @ that started this mention
      const atPos = textBefore.lastIndexOf("@");
      if (atPos === -1) return;

      const newText = textBefore.slice(0, atPos) + `@${agentName} ` + textAfter;
      setInput(newText);
      setMentionQuery(null);
      setMentionIndex(0);

      // Restore focus after state update
      setTimeout(() => {
        textarea.focus();
        const newCursorPos = atPos + agentName.length + 2;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    },
    [input]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInput(value);

    // Check for @mention trigger
    const cursorPos = e.target.selectionStart;
    const textBefore = value.slice(0, cursorPos);
    const atMatch = textBefore.match(/@(\w*)$/);
    if (atMatch) {
      setMentionQuery(atMatch[1]);
      setMentionIndex(0);
    } else {
      setMentionQuery(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle mention navigation
    if (mentionQuery !== null && mentionSuggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex((prev) =>
          prev < mentionSuggestions.length - 1 ? prev + 1 : 0
        );
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex((prev) =>
          prev > 0 ? prev - 1 : mentionSuggestions.length - 1
        );
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(mentionSuggestions[mentionIndex].name);
        return;
      }
      if (e.key === "Escape") {
        setMentionQuery(null);
        return;
      }
    }

    // Submit on Enter (without Shift)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isProcessing) return;

    const userMessage = input.trim();
    const msgId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      {
        id: msgId,
        role: "user",
        content: userMessage,
        timestamp: new Date(),
      },
    ]);
    setInput("");
    setMentionQuery(null);
    setIsProcessing(true);
    setActiveDelegations([]);

    try {
      // Build history from existing messages
      const history = messages
        .filter((m) => m.role !== "system")
        .map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }));

      const res = await apiFetch("/api/team-chat", {
        method: "POST",
        body: JSON.stringify({
          message: userMessage,
          history,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(err.error || "Request failed");
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";
      const collectedAgentResults: AgentResultEvent[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buffer.indexOf("\n\n")) !== -1) {
          const block = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);

          let event = "";
          let data = "";
          for (const line of block.split("\n")) {
            if (line.startsWith("event: ")) event = line.slice(7).trim();
            else if (line.startsWith("data: ")) data += line.slice(6);
          }

          if (!event || !data) continue;

          try {
            const parsed = JSON.parse(data);

            if (event === "delegation") {
              setActiveDelegations((prev) => [...prev, parsed]);
            } else if (event === "agent_result") {
              collectedAgentResults.push(parsed);
              // Remove from active delegations
              setActiveDelegations((prev) =>
                prev.filter((d) => d.agentName !== parsed.agentName)
              );
            } else if (event === "broadcast") {
              setActiveDelegations(
                activeAgents.map((a: any) => ({
                  agentName: a.name,
                  agentId: a.id,
                  task: parsed.task,
                }))
              );
            } else if (event === "result") {
              setMessages((prev) => [
                ...prev,
                {
                  id: crypto.randomUUID(),
                  role: "assistant",
                  content: parsed.text || "Task completed.",
                  timestamp: new Date(),
                  agentResults: collectedAgentResults,
                },
              ]);
              setActiveDelegations([]);
            } else if (event === "error") {
              setMessages((prev) => [
                ...prev,
                {
                  id: crypto.randomUUID(),
                  role: "assistant",
                  content: `Error: ${parsed.message}`,
                  timestamp: new Date(),
                },
              ]);
            }
          } catch {
            // Ignore parse errors
          }
        }
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `Error: ${err instanceof Error ? err.message : "Failed to connect"}`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsProcessing(false);
      setActiveDelegations([]);
      inputRef.current?.focus();
    }
  };

  const typeColors: Record<string, string> = {
    general: "#7C3AED",
    email: "#3B82F6",
    calendar: "#F59E0B",
    documents: "#10B981",
    data: "#06B6D4",
    social: "#EC4899",
    custom: "#8B5CF6",
  };

  return (
    <div className="flex h-full">
      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 h-14 border-b border-border shrink-0">
          <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
            <Users className="w-4.5 h-4.5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-sm">Team Chat</h2>
            <p className="text-xs text-muted-foreground">
              {activeAgents.length} agent{activeAgents.length !== 1 ? "s" : ""}{" "}
              available
            </p>
          </div>
          <button
            onClick={() => setShowRoster(!showRoster)}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            title={showRoster ? "Hide roster" : "Show roster"}
          >
            <Bot className="w-4 h-4" />
          </button>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {messages.length === 0 && !isProcessing ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <MessageSquare className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-base font-medium mb-1">Team Chat</h3>
              <p className="text-sm text-muted-foreground max-w-sm mb-6">
                Talk to your entire agent team. Use @AgentName to target
                specific agents, or just describe what you need.
              </p>
              {activeAgents.length > 0 && (
                <div className="flex flex-col gap-2 w-full max-w-sm">
                  <button
                    type="button"
                    onClick={() =>
                      setInput(
                        `@${activeAgents[0].name} Give me a status update`
                      )
                    }
                    className="text-left text-sm px-3 py-2.5 rounded-xl border border-border/60 bg-secondary/30 hover:bg-secondary/60 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    @{activeAgents[0].name} Give me a status update
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setInput("Everyone, adopt a professional and concise tone")
                    }
                    className="text-left text-sm px-3 py-2.5 rounded-xl border border-border/60 bg-secondary/30 hover:bg-secondary/60 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Everyone, adopt a professional and concise tone
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setInput("List all my agents and their capabilities")
                    }
                    className="text-left text-sm px-3 py-2.5 rounded-xl border border-border/60 bg-secondary/30 hover:bg-secondary/60 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    List all my agents and their capabilities
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-secondary text-foreground rounded-bl-md"
                    }`}
                  >
                    {msg.role === "assistant" && (
                      <div className="flex items-center gap-1.5 mb-2">
                        <Users className="w-3.5 h-3.5 text-primary" />
                        <span className="text-xs font-medium text-primary">
                          Team Orchestrator
                        </span>
                      </div>
                    )}

                    {/* Agent result badges */}
                    {msg.agentResults && msg.agentResults.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {msg.agentResults.map((r, i) => (
                          <span
                            key={i}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                              r.status === "completed"
                                ? "bg-green-500/15 text-green-400"
                                : "bg-red-500/15 text-red-400"
                            }`}
                          >
                            {r.status === "completed" ? (
                              <CheckCircle2 className="w-2.5 h-2.5" />
                            ) : (
                              <XCircle className="w-2.5 h-2.5" />
                            )}
                            {r.agentName}
                            {r.durationMs && (
                              <span className="opacity-60">
                                {(r.durationMs / 1000).toFixed(1)}s
                              </span>
                            )}
                          </span>
                        ))}
                      </div>
                    )}

                    <p className="whitespace-pre-wrap leading-relaxed">
                      {msg.content}
                    </p>
                  </div>
                </div>
              ))}

              {/* Active delegation indicators */}
              {activeDelegations.length > 0 && (
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-bl-md bg-secondary px-4 py-3 max-w-[85%]">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Users className="w-3.5 h-3.5 text-primary" />
                      <span className="text-xs font-medium text-primary">
                        Team Orchestrator
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {activeDelegations.map((d, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 text-xs text-muted-foreground"
                        >
                          <Loader2 className="w-3 h-3 animate-spin text-primary" />
                          <span>
                            Delegating to{" "}
                            <span className="font-medium text-foreground">
                              {d.agentName}
                            </span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Processing indicator (no active delegations yet) */}
              {isProcessing && activeDelegations.length === 0 && (
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-bl-md bg-secondary px-4 py-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                      Analyzing your request...
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input area */}
        <div className="border-t border-border px-6 py-3 shrink-0">
          <div className="relative">
            {/* @mention autocomplete */}
            {mentionQuery !== null && mentionSuggestions.length > 0 && (
              <div className="absolute bottom-full mb-2 left-0 w-64 bg-card border border-border rounded-xl shadow-lg overflow-hidden z-10">
                {mentionSuggestions.slice(0, 5).map((agent: any, i: number) => (
                  <button
                    key={agent.id}
                    type="button"
                    onClick={() => insertMention(agent.name)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors ${
                      i === mentionIndex
                        ? "bg-primary/10 text-foreground"
                        : "text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    <div
                      className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                      style={{
                        backgroundColor: `${typeColors[agent.type] || "#7C3AED"}15`,
                      }}
                    >
                      <Bot
                        className="w-3 h-3"
                        style={{
                          color: typeColors[agent.type] || "#7C3AED",
                        }}
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-xs truncate">
                        {agent.name}
                      </div>
                      <div className="text-[10px] text-muted-foreground truncate">
                        {agent.type} &middot; {agent.role || "No role"}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <textarea
                ref={inputRef}
                placeholder="Talk to your team... Use @AgentName to target"
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                disabled={isProcessing}
                rows={1}
                className="flex-1 px-3 py-2 rounded-lg bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none min-h-[38px] max-h-32"
                style={{
                  height: "auto",
                  minHeight: "38px",
                }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = "auto";
                  target.style.height = `${Math.min(target.scrollHeight, 128)}px`;
                }}
              />
              <button
                onClick={handleSend}
                disabled={isProcessing || !input.trim()}
                className="px-3 py-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-50 transition-colors self-end"
              >
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Agent Roster Panel */}
      {showRoster && (
        <aside className="w-64 border-l border-border bg-card shrink-0 overflow-y-auto">
          <div className="p-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Agent Roster
            </h3>
            <div className="space-y-1.5">
              {Array.isArray(agents) &&
                agents.map((agent: any) => {
                  const color = typeColors[agent.type] || "#7C3AED";
                  const isActive = activeDelegations.some(
                    (d) => d.agentId === agent.id
                  );
                  return (
                    <button
                      key={agent.id}
                      type="button"
                      onClick={() => {
                        setInput((prev) =>
                          prev ? `${prev} @${agent.name} ` : `@${agent.name} `
                        );
                        inputRef.current?.focus();
                      }}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors ${
                        isActive
                          ? "bg-primary/10 ring-1 ring-primary/30"
                          : "hover:bg-secondary"
                      }`}
                    >
                      <div className="relative">
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: `${color}15` }}
                        >
                          <Bot className="w-3.5 h-3.5" style={{ color }} />
                        </div>
                        {/* Status dot */}
                        <div
                          className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-card ${
                            agent.isActive ? "bg-green-500" : "bg-zinc-500"
                          }`}
                        />
                        {/* Pulse animation when active */}
                        {isActive && (
                          <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-primary animate-ping" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium truncate">
                          {agent.name}
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          {agent.role || agent.type}
                        </div>
                      </div>
                      {isActive && (
                        <Loader2 className="w-3 h-3 animate-spin text-primary shrink-0" />
                      )}
                    </button>
                  );
                })}
            </div>

            {/* Hierarchy overview */}
            {Array.isArray(agents) &&
              agents.some((a: any) => a.parentAgentId) && (
                <div className="mt-4 pt-4 border-t border-border">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Hierarchy
                  </h3>
                  <div className="space-y-2">
                    {agents
                      .filter(
                        (a: any) =>
                          !a.parentAgentId &&
                          agents.some(
                            (sub: any) => sub.parentAgentId === a.id
                          )
                      )
                      .map((manager: any) => (
                        <div key={manager.id} className="text-xs">
                          <div className="flex items-center gap-1.5 font-medium text-foreground">
                            <ChevronRight className="w-3 h-3 text-primary" />
                            {manager.name}
                          </div>
                          <div className="ml-4 mt-0.5 space-y-0.5">
                            {agents
                              .filter(
                                (sub: any) => sub.parentAgentId === manager.id
                              )
                              .map((sub: any) => (
                                <div
                                  key={sub.id}
                                  className="text-muted-foreground flex items-center gap-1"
                                >
                                  <span className="w-2 h-px bg-border" />
                                  {sub.name}
                                </div>
                              ))}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
          </div>
        </aside>
      )}
    </div>
  );
}
