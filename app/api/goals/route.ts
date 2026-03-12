import { NextResponse } from "next/server";
import { getEffectiveSession } from "@/lib/auth-utils";
import {
  getGoalsByWorkspace,
  createGoal,
  getGoalById,
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

  const goals = await getGoalsByWorkspace(workspaceId);
  return NextResponse.json(goals);
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
  const { title, description, parentGoalId, assignedAgentId, priority, dueAt } =
    body;

  if (!title || typeof title !== "string" || title.trim() === "") {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  // Validate parentGoalId ownership
  if (parentGoalId) {
    const parentGoal = await getGoalById(parentGoalId);
    if (!parentGoal || parentGoal.workspaceId !== workspaceId) {
      return NextResponse.json(
        { error: "Parent goal not found in this workspace" },
        { status: 400 }
      );
    }
  }

  // Validate assignedAgentId ownership
  if (assignedAgentId) {
    const agent = await getAgentById(assignedAgentId);
    if (!agent || agent.workspaceId !== workspaceId) {
      return NextResponse.json(
        { error: "Agent not found in this workspace" },
        { status: 400 }
      );
    }
  }

  const goal = await createGoal({
    workspaceId,
    title: title.trim(),
    description: description || null,
    parentGoalId: parentGoalId || null,
    assignedAgentId: assignedAgentId || null,
    priority: priority ?? 0,
    dueAt: dueAt ? new Date(dueAt) : null,
  });

  return NextResponse.json(goal, { status: 201 });
}
