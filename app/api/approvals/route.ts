import { NextResponse } from "next/server";
import { getEffectiveSession } from "@/lib/auth-utils";
import {
  getApprovalsByWorkspace,
  createApproval,
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

  const url = new URL(request.url);
  const status = url.searchParams.get("status") || undefined;
  const limitParam = url.searchParams.get("limit");
  const limit = limitParam ? parseInt(limitParam) : undefined;

  const approvals = await getApprovalsByWorkspace(workspaceId, {
    status,
    limit,
  });
  // Flatten joined result for frontend consumption
  const flat = approvals.map((a) => ({
    ...a.approval,
    agentName: a.agentName,
  }));
  return NextResponse.json(flat);
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
  const { agentId, action, actionType, runId, metadata } = body;

  if (!agentId || typeof agentId !== "string") {
    return NextResponse.json(
      { error: "agentId is required" },
      { status: 400 }
    );
  }

  if (!action || typeof action !== "string") {
    return NextResponse.json(
      { error: "action is required" },
      { status: 400 }
    );
  }

  if (!actionType || typeof actionType !== "string") {
    return NextResponse.json(
      { error: "actionType is required" },
      { status: 400 }
    );
  }

  const validActionTypes = [
    "budget_override",
    "prompt_change",
    "delegation",
    "external_action",
    "high_cost",
  ];
  if (!validActionTypes.includes(actionType)) {
    return NextResponse.json(
      {
        error: `actionType must be one of: ${validActionTypes.join(", ")}`,
      },
      { status: 400 }
    );
  }

  // Validate agent belongs to workspace
  const agent = await getAgentById(agentId);
  if (!agent || agent.workspaceId !== workspaceId) {
    return NextResponse.json(
      { error: "Agent not found in this workspace" },
      { status: 404 }
    );
  }

  const approval = await createApproval({
    workspaceId,
    agentId,
    action,
    actionType,
    runId: runId || null,
    metadata: metadata || null,
  });

  return NextResponse.json(approval, { status: 201 });
}
