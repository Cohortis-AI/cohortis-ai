import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { getAgentById, updateAgent, deleteAgent } from "@/lib/db/queries";
import { requireWorkspaceAccess } from "@/lib/workspace/auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { agentId } = await params;
  const agent = await getAgentById(agentId);
  if (!agent) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    await requireWorkspaceAccess(session.user.id, agent.workspaceId);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(agent);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { agentId } = await params;
  const agent = await getAgentById(agentId);
  if (!agent) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    await requireWorkspaceAccess(session.user.id, agent.workspaceId);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();

  // Validate parentAgentId depth if changing hierarchy
  if (body.parentAgentId !== undefined) {
    if (body.parentAgentId === agentId) {
      return NextResponse.json(
        { error: "An agent cannot be its own parent" },
        { status: 400 }
      );
    }

    if (body.parentAgentId) {
      const depth = await computeDepth(body.parentAgentId);
      if (depth >= 3) {
        return NextResponse.json(
          { error: "Maximum hierarchy depth (3) exceeded" },
          { status: 400 }
        );
      }
    }
  }

  const updated = await updateAgent(agentId, body);
  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { agentId } = await params;
  const agent = await getAgentById(agentId);
  if (!agent) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    await requireWorkspaceAccess(session.user.id, agent.workspaceId, "admin");
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await deleteAgent(agentId);
  return NextResponse.json({ deleted: true });
}

async function computeDepth(parentAgentId: string): Promise<number> {
  let depth = 1;
  let current = await getAgentById(parentAgentId);
  while (current?.parentAgentId && depth < 10) {
    current = await getAgentById(current.parentAgentId);
    depth++;
  }
  return depth;
}
