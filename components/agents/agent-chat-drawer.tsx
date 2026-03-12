"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Send,
  Loader2,
  Bot,
  ArrowDown,
  Plus,
} from "lucide-react";
import { mutate } from "swr";
import {
  type AgentData,
  typeIcons,
  typeColors,
} from "@/lib/agents/types";
import { apiFetch } from "@/lib/api-client";

interface AgentChatDrawerProps {
  agent: AgentData | null;
  open: boolean;
  onClose: () => void;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function AgentChatDrawer({ agent, open, onClose }: AgentChatDrawerProps) {
  const [conversation, setConversation] = useState<ChatMessage[]>([]);
  const [taskInput, setTaskInput] = useState("");
  const [executing, setExecuting] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const executingRef = useRef(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Focus input when modal opens
  useEffect(() => {
    if (open && agent) {
      const isTouch = window.matchMedia("(pointer: coarse)").matches;
      if (!isTouch) {
        setTimeout(() => inputRef.current?.focus(), 300);
      }
    }
  }, [open, agent]);

  // Reset conversation when agent changes
  useEffect(() => {
    if (agent) {
      setConversation([]);
      setTaskInput("");
    }
  }, [agent?.id]);

  // Lock body scroll
  useEffect(() => {
    if (open) {
      const original = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = original;
      };
    }
  }, [open]);

  // Escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open && !executing) onClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [open, executing, onClose]);

  // Auto-scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation.length, executing]);

  // Scroll-to-bottom button
  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;
    const handleScroll = () => {
      const atBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight <
        80;
      setShowScrollBtn(!atBottom);
    };
    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [open]);

  const handleNewConversation = () => {
    setConversation([]);
    setTaskInput("");
    inputRef.current?.focus();
  };

  const handleExecute = async () => {
    if (!taskInput.trim() || executingRef.current || !agent) return;
    executingRef.current = true;
    const userMsg = taskInput.trim();
    setExecuting(true);

    const updatedConversation: ChatMessage[] = [
      ...conversation,
      { role: "user", content: userMsg },
    ];
    setConversation(updatedConversation);
    setTaskInput("");

    try {
      const res = await apiFetch(`/api/agents/${agent.id}/execute`, {
        method: "POST",
        body: JSON.stringify({
          task: userMsg,
          history: updatedConversation,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";
      let finalResult: any = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        let doubleNewline: number;
        while ((doubleNewline = buffer.indexOf("\n\n")) !== -1) {
          const block = buffer.slice(0, doubleNewline);
          buffer = buffer.slice(doubleNewline + 2);

          let blockEvent = "";
          let blockData = "";
          for (const line of block.split("\n")) {
            if (line.startsWith("event: ")) {
              blockEvent = line.slice(7).trim();
            } else if (line.startsWith("data: ")) {
              blockData += line.slice(6);
            }
          }

          if (blockEvent === "result" && blockData) {
            try {
              finalResult = JSON.parse(blockData);
            } catch {}
          }
        }
      }

      if (finalResult) {
        const assistantMsg =
          finalResult.status === "completed"
            ? finalResult.result || "Task completed."
            : `Error: ${finalResult.error || "Task failed"}`;
        setConversation((prev) => [
          ...prev,
          { role: "assistant", content: assistantMsg },
        ]);
      } else {
        setConversation((prev) => [
          ...prev,
          { role: "assistant", content: "No response received." },
        ]);
      }

      mutate("/api/agents");
    } catch {
      setConversation((prev) => [
        ...prev,
        { role: "assistant", content: "Failed to execute task." },
      ]);
    } finally {
      executingRef.current = false;
      setExecuting(false);
    }
  };

  if (!agent || !mounted) return null;

  const agentType = agent.type || "general";
  const AgentIcon = typeIcons[agentType] || Bot;
  const color = typeColors[agentType] || "#7C3AED";

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={!executing ? onClose : undefined}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal={open}
        aria-hidden={!open}
        className={`fixed inset-4 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 z-[70] flex flex-col bg-background rounded-2xl border border-border shadow-2xl transition-all duration-300 ease-out ${
          open
            ? "opacity-100 scale-100"
            : "opacity-0 scale-95 pointer-events-none"
        }`}
        style={{
          width: "min(720px, calc(100vw - 2rem))",
          height: "min(700px, calc(100vh - 2rem))",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0 rounded-t-2xl"
          style={{ background: `${color}08` }}
        >
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: `${color}20` }}
          >
            <AgentIcon className="w-4.5 h-4.5" style={{ color }} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-foreground truncate text-sm">
              {agent.name}
            </h2>
            {agent.role && (
              <p className="text-xs text-primary/80 font-medium truncate">
                {agent.role}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={handleNewConversation}
              disabled={executing}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
              title="New conversation"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={executing}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Chat Area */}
        <div
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto px-5 py-4 space-y-4 relative"
        >
          {conversation.length === 0 && !executing ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3"
                style={{ background: `${color}15` }}
              >
                <AgentIcon className="w-7 h-7" style={{ color }} />
              </div>
              <h3 className="text-base font-medium text-foreground mb-1">
                Chat with {agent.name}
              </h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                {agent.description || "Send a task to get started."}
              </p>
              {agent.conversationStarters &&
                agent.conversationStarters.length > 0 && (
                  <div className="flex flex-col gap-2 mt-4 w-full max-w-sm">
                    {agent.conversationStarters.map((starter, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setTaskInput(starter)}
                        className="text-left text-sm px-3 py-2.5 rounded-xl border border-border/60 bg-secondary/30 hover:bg-secondary/60 hover:border-border text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {starter}
                      </button>
                    ))}
                  </div>
                )}
            </div>
          ) : (
            <>
              {conversation.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-secondary text-foreground rounded-bl-md"
                    }`}
                  >
                    {msg.role === "assistant" && (
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <AgentIcon
                          className="w-3.5 h-3.5"
                          style={{ color }}
                        />
                        <span
                          className="text-xs font-medium"
                          style={{ color }}
                        >
                          {agent.name}
                        </span>
                      </div>
                    )}
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))}

              {executing && (
                <div className="flex justify-start">
                  <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-secondary px-4 py-3">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <AgentIcon
                        className="w-3.5 h-3.5"
                        style={{ color }}
                      />
                      <span
                        className="text-xs font-medium"
                        style={{ color }}
                      >
                        {agent.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Thinking...
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          <div ref={chatEndRef} />

          {showScrollBtn && (
            <div className="sticky bottom-4 flex justify-center z-10 pointer-events-none">
              <button
                type="button"
                className="h-8 w-8 rounded-full bg-secondary border border-border shadow-lg flex items-center justify-center pointer-events-auto hover:bg-secondary/80 transition-colors"
                onClick={() =>
                  chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
                }
              >
                <ArrowDown className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="border-t border-border px-5 py-3 shrink-0 rounded-b-2xl">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              placeholder={`Ask ${agent.name} to do something...`}
              value={taskInput}
              onChange={(e) => setTaskInput(e.target.value)}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  !e.shiftKey &&
                  !e.nativeEvent.isComposing
                ) {
                  e.preventDefault();
                  handleExecute();
                }
              }}
              disabled={executing}
              className="flex-1 px-3 py-2 rounded-lg bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <button
              type="button"
              onClick={handleExecute}
              disabled={executing || !taskInput.trim()}
              className="px-3 py-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-50 transition-colors"
            >
              {executing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
