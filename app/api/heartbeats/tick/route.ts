import { NextResponse } from "next/server";
import {
  getDueHeartbeats,
  getAgentById,
  markHeartbeatRun,
} from "@/lib/db/queries";
import { executeAgentTask } from "@/lib/agents/executor";

export const maxDuration = 300;

export async function POST(request: Request) {
  // Authenticate via CRON_SECRET
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dueHeartbeats = await getDueHeartbeats();

  if (dueHeartbeats.length === 0) {
    return NextResponse.json({ processed: 0 });
  }

  const results: Array<{
    heartbeatId: string;
    agentId: string;
    status: string;
  }> = [];

  for (const heartbeat of dueHeartbeats) {
    try {
      const agent = await getAgentById(heartbeat.agentId);

      if (!agent || !agent.isActive) {
        await markHeartbeatRun(
          heartbeat.id,
          "failed",
          agent ? "Agent is paused" : "Agent not found"
        );
        results.push({
          heartbeatId: heartbeat.id,
          agentId: heartbeat.agentId,
          status: "failed",
        });
        continue;
      }

      const result = await executeAgentTask({
        agent,
        task: heartbeat.task,
        workspaceId: heartbeat.workspaceId,
      });

      const status = result.status === "failed" ? "failed" : "completed";
      await markHeartbeatRun(
        heartbeat.id,
        status,
        ("result" in result ? result.result : undefined) ||
          ("error" in result ? result.error : undefined) ||
          null
      );

      results.push({
        heartbeatId: heartbeat.id,
        agentId: heartbeat.agentId,
        status,
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      await markHeartbeatRun(heartbeat.id, "failed", errorMsg);
      results.push({
        heartbeatId: heartbeat.id,
        agentId: heartbeat.agentId,
        status: "failed",
      });
    }
  }

  return NextResponse.json({
    processed: results.length,
    results,
  });
}
