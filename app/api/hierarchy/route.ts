import { NextResponse } from "next/server";
import { getEffectiveSession } from "@/lib/auth-utils";
import {
  getAgentsByWorkspace,
  getAgentById,
  updateAgent,
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

  const agents = await getAgentsByWorkspace(workspaceId);

  // Return flat list — the client builds the tree
  return NextResponse.json(
    agents.map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      type: a.type,
      icon: a.icon,
      role: a.role,
      parentAgentId: a.parentAgentId,
      isActive: a.isActive,
      totalTasksCompleted: a.totalTasksCompleted,
      totalTasksFailed: a.totalTasksFailed,
      model: a.model,
    }))
  );
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
    await requireWorkspaceAccess(session.user.id, workspaceId, "admin");
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const updates: Array<{ agentId: string; parentAgentId: string | null }> =
    body.updates;

  if (!Array.isArray(updates)) {
    return NextResponse.json(
      { error: "updates array required" },
      { status: 400 }
    );
  }

  // Validate all agents belong to workspace
  for (const update of updates) {
    const agent = await getAgentById(update.agentId);
    if (!agent || agent.workspaceId !== workspaceId) {
      return NextResponse.json(
        { error: `Agent ${update.agentId} not found in workspace` },
        { status: 400 }
      );
    }
  }

  // Apply updates
  const results = [];
  for (const update of updates) {
    const updated = await updateAgent(update.agentId, {
      parentAgentId: update.parentAgentId,
    });
    results.push(updated);
  }

  return NextResponse.json({ updated: results.length });
}
