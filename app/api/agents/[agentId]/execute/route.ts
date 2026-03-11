import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { getAgentById } from "@/lib/db/queries";
import { executeAgentTask } from "@/lib/agents/executor";
import type { ConversationMessage } from "@/lib/agents/executor";
import { requireWorkspaceAccess } from "@/lib/workspace/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { checkRunLimit } from "@/lib/billing/plans";

export const maxDuration = 300;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit: 10 executions per minute per user
  const rl = checkRateLimit(`agent:${session.user.id}`, 10, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: {
          "Retry-After": String(
            Math.ceil((rl.resetAt - Date.now()) / 1000)
          ),
        },
      }
    );
  }

  const { agentId } = await params;
  const agent = await getAgentById(agentId);

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  try {
    await requireWorkspaceAccess(session.user.id, agent.workspaceId);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!agent.isActive) {
    return NextResponse.json({ error: "Agent is paused" }, { status: 400 });
  }

  // Check workspace run limit
  const runLimit = await checkRunLimit(agent.workspaceId);
  if (!runLimit.allowed) {
    return NextResponse.json(
      {
        error: "Monthly run limit reached",
        current: runLimit.current,
        limit: runLimit.limit,
        plan: runLimit.plan,
      },
      { status: 403 }
    );
  }

  const body = await request.json();
  const { task, history, timezone } = body;

  if (!task || typeof task !== "string" || task.trim() === "") {
    return NextResponse.json({ error: "task is required" }, { status: 400 });
  }

  const conversationHistory: ConversationMessage[] = Array.isArray(history)
    ? history
    : [];

  // SSE streaming response
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          // Stream closed
        }
      };

      executeAgentTask({
        agent,
        task: task.trim(),
        workspaceId: agent.workspaceId,
        history: conversationHistory.length > 0 ? conversationHistory : undefined,
        userTimezone: timezone,
        initiatedBy: session.user!.id,
        callbacks: {
          onProgress: send,
        },
      })
        .then((result) => {
          send("result", result);
          controller.close();
        })
        .catch((err) => {
          send("result", {
            status: "failed",
            error: err instanceof Error ? err.message : String(err),
          });
          controller.close();
        });
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
