"use client";

import { useState, useRef, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import {
  Bot,
  Send,
  Loader2,
  ArrowLeft,
  Settings,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowDown,
} from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function AgentDetailPage() {
  const { agentId } = useParams<{ agentId: string }>();
  const router = useRouter();
  const { data: agent, isLoading } = useSWR(`/api/agents/${agentId}`, fetcher);
  const { data: runs } = useSWR(`/api/agents/${agentId}/runs`, fetcher);

  const [taskInput, setTaskInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [executing, setExecuting] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, executing]);

  const handleExecute = async () => {
    if (!taskInput.trim() || executing) return;

    const userMsg = taskInput.trim();
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setTaskInput("");
    setExecuting(true);

    try {
      const res = await fetch(`/api/agents/${agentId}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: userMsg,
          history: messages,
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
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: assistantMsg },
        ]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Failed to execute task." },
      ]);
    } finally {
      setExecuting(false);
      inputRef.current?.focus();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Agent not found</p>
      </div>
    );
  }

  const color = "#7C3AED";

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 h-14 border-b border-border shrink-0">
        <button
          onClick={() => router.push("/agents")}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: `${color}15` }}
        >
          <Bot className="w-4.5 h-4.5" style={{ color }} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-sm truncate">{agent.name}</h2>
          {agent.role && (
            <p className="text-xs text-muted-foreground truncate">
              {agent.role}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-green-500" />
            {agent.totalTasksCompleted || 0}
          </span>
          <span className="flex items-center gap-1">
            <XCircle className="w-3 h-3 text-red-500" />
            {agent.totalTasksFailed || 0}
          </span>
        </div>
        <button
          onClick={() => router.push(`/agents/${agentId}/edit`)}
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 && !executing ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
              style={{ backgroundColor: `${color}15` }}
            >
              <Bot className="w-8 h-8" style={{ color }} />
            </div>
            <h3 className="text-base font-medium mb-1">{agent.name}</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              {agent.description || "Send a task to get started."}
            </p>
            {agent.conversationStarters?.length > 0 && (
              <div className="flex flex-col gap-2 mt-4 w-full max-w-sm">
                {agent.conversationStarters.map(
                  (starter: string, i: number) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setTaskInput(starter)}
                      className="text-left text-sm px-3 py-2.5 rounded-xl border border-border/60 bg-secondary/30 hover:bg-secondary/60 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {starter}
                    </button>
                  )
                )}
              </div>
            )}
          </div>
        ) : (
          <>
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-secondary text-foreground rounded-bl-md"
                  }`}
                >
                  {msg.role === "assistant" && (
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Bot className="w-3.5 h-3.5" style={{ color }} />
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
                <div className="rounded-2xl rounded-bl-md bg-secondary px-4 py-3">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Bot className="w-3.5 h-3.5" style={{ color }} />
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
      </div>

      {/* Input */}
      <div className="border-t border-border px-6 py-3 shrink-0">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            placeholder={`Ask ${agent.name} to do something...`}
            value={taskInput}
            onChange={(e) => setTaskInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleExecute();
              }
            }}
            disabled={executing}
            className="flex-1 px-3 py-2 rounded-lg bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <button
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
  );
}
