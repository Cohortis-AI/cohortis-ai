import { NextResponse } from "next/server";
import { generateText } from "ai";
import type { CoreMessage } from "ai";
import { getEffectiveSession } from "@/lib/auth-utils";
import { getAgentsByWorkspace } from "@/lib/db/queries";
import { requireWorkspaceAccess } from "@/lib/workspace/auth";
import { getModel } from "@/lib/ai/providers";
import { buildOrchestratorPrompt } from "@/lib/team-chat/orchestrator-prompt";
import { createDelegationTools } from "@/lib/team-chat/delegation-tools";
import { parseMentions } from "@/lib/team-chat/mention-parser";

export const maxDuration = 300;

export async function POST(request: Request) {
  const session = await getEffectiveSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceId = request.headers.get("x-workspace-id");
  if (!workspaceId) {
    return NextResponse.json({ error: "No workspace" }, { status: 400 });
  }

  try {
    await requireWorkspaceAccess(session.user.id, workspaceId);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { message, history = [], timezone } = body as {
    message: string;
    history: Array<{ role: "user" | "assistant"; content: string }>;
    timezone?: string;
  };

  if (!message?.trim()) {
    return NextResponse.json({ error: "Empty message" }, { status: 400 });
  }

  // Load workspace agents
  const workspaceAgents = await getAgentsByWorkspace(workspaceId);
  if (workspaceAgents.length === 0) {
    return NextResponse.json(
      { error: "No agents in workspace. Create agents first." },
      { status: 400 }
    );
  }

  // Parse @mentions
  const { cleanText } = parseMentions(
    message,
    workspaceAgents.map((a) => ({ id: a.id, name: a.name }))
  );

  // Build orchestrator system prompt
  const systemPrompt = buildOrchestratorPrompt(workspaceAgents);

  // Build delegation tools
  const delegationTools = createDelegationTools(
    workspaceAgents,
    workspaceId,
    session.user.id,
    timezone
  );

  // Build conversation messages
  const historyMessages: CoreMessage[] = (history || [])
    .slice(-20)
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

  let messages: CoreMessage[] = [
    ...historyMessages,
    { role: "user", content: cleanText },
  ];

  // SSE stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      try {
        send("status", { phase: "thinking", message: "Analyzing your request..." });

        const MAX_STEPS = 30;
        let finalText = "";
        let totalTokens = 0;
        const agentResults: Array<{
          agentName: string;
          agentType: string | null;
          status: string;
          durationMs?: number;
        }> = [];

        for (let step = 0; step < MAX_STEPS; step++) {
          const result = await generateText({
            model: getModel("gpt-5.2"),
            system: systemPrompt,
            messages,
            tools: delegationTools,
          });

          // Track delegations for status events
          for (const s of result.steps) {
            for (const tc of s.toolCalls || []) {
              if (tc.toolName === "delegate_to_agent") {
                const agent = workspaceAgents.find(
                  (a) => a.id === (tc.args as any).agentId
                );
                send("delegation", {
                  agentName: agent?.name || "Unknown",
                  agentId: (tc.args as any).agentId,
                  task: (tc.args as any).task,
                });
              }
              if (tc.toolName === "broadcast_to_agents") {
                send("broadcast", {
                  task: (tc.args as any).task,
                  agentCount: workspaceAgents.filter((a) => a.isActive).length,
                });
              }
            }
            // Track results from tool calls
            for (const tr of s.toolResults || []) {
              const toolResult = tr.result as any;
              if (toolResult?.agentName && toolResult?.status) {
                agentResults.push({
                  agentName: toolResult.agentName,
                  agentType: toolResult.agentType || null,
                  status: toolResult.status,
                  durationMs: toolResult.durationMs,
                });
                send("agent_result", {
                  agentName: toolResult.agentName,
                  status: toolResult.status,
                  durationMs: toolResult.durationMs,
                });
              }
              // Handle broadcast results
              if (toolResult?.results && Array.isArray(toolResult.results)) {
                for (const r of toolResult.results) {
                  if (r.agentName) {
                    agentResults.push({
                      agentName: r.agentName,
                      agentType: r.agentType || null,
                      status: r.status,
                      durationMs: r.durationMs,
                    });
                    send("agent_result", {
                      agentName: r.agentName,
                      status: r.status,
                    });
                  }
                }
              }
            }
          }

          if (result.text) finalText = result.text;
          totalTokens += result.usage?.totalTokens || 0;

          if (result.finishReason !== "tool-calls") break;

          // Continue the agentic loop
          const responseMessages = result.response.messages as CoreMessage[];
          messages = [...messages, ...responseMessages];
        }

        send("result", {
          text: finalText,
          totalTokens,
          agentResults,
        });
      } catch (err) {
        send("error", {
          message: err instanceof Error ? err.message : String(err),
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
