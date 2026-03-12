import { NextResponse } from "next/server";
import { getEffectiveSession } from "@/lib/auth-utils";
import {
  getHeartbeatsByWorkspace,
  createHeartbeat,
  getAgentById,
} from "@/lib/db/queries";
import { requireWorkspaceAccess } from "@/lib/workspace/auth";

export async function GET(request: Request) {
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

  const heartbeats = await getHeartbeatsByWorkspace(workspaceId);
  return NextResponse.json(heartbeats);
}

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
  const { agentId, task, frequency } = body;

  if (!agentId || typeof agentId !== "string") {
    return NextResponse.json(
      { error: "agentId is required" },
      { status: 400 }
    );
  }

  if (!task || typeof task !== "string" || task.trim() === "") {
    return NextResponse.json({ error: "task is required" }, { status: 400 });
  }

  // Validate agent belongs to workspace
  const agent = await getAgentById(agentId);
  if (!agent || agent.workspaceId !== workspaceId) {
    return NextResponse.json(
      { error: "Agent not found in this workspace" },
      { status: 400 }
    );
  }

  const validFrequencies = ["5m", "15m", "30m", "1h", "4h", "12h", "24h"];
  if (frequency && !validFrequencies.includes(frequency)) {
    return NextResponse.json(
      { error: "Invalid frequency" },
      { status: 400 }
    );
  }

  const heartbeat = await createHeartbeat({
    workspaceId,
    agentId,
    task: task.trim(),
    frequency: frequency || "1h",
  });

  return NextResponse.json(heartbeat, { status: 201 });
}
