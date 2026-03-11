import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { getAgentsByWorkspace, createAgent, getAgentById } from "@/lib/db/queries";
import { requireWorkspaceAccess } from "@/lib/workspace/auth";
import { checkAgentLimit } from "@/lib/billing/plans";

export async function GET(request: Request) {
  const session = await auth();
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
  return NextResponse.json(agents);
}

export async function POST(request: Request) {
  const session = await auth();
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

  const { allowed, current, limit, plan } = await checkAgentLimit(workspaceId);
  if (!allowed) {
    return NextResponse.json(
      { error: "Agent limit reached", current, limit, plan },
      { status: 403 }
    );
  }

  const body = await request.json();
  const {
    name,
    description,
    type,
    icon,
    role,
    parentAgentId,
    systemPrompt,
    capabilities,
    model,
    provider,
    customSkills,
    knowledgeFiles,
    conversationStarters,
  } = body;

  if (!name || typeof name !== "string" || name.trim() === "") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  // Validate parentAgentId ownership
  if (parentAgentId) {
    const parentAgent = await getAgentById(parentAgentId);
    if (!parentAgent || parentAgent.workspaceId !== workspaceId) {
      return NextResponse.json(
        { error: "Parent agent not found in this workspace" },
        { status: 400 }
      );
    }
  }

  const agent = await createAgent({
    workspaceId,
    userId: session.user.id,
    name: name.trim(),
    description,
    type: type || "general",
    icon,
    role,
    parentAgentId,
    systemPrompt,
    capabilities: capabilities || [],
    model: model || "gpt-5.2",
    provider: provider || "openai",
    customSkills,
    knowledgeFiles,
    conversationStarters,
  });

  return NextResponse.json(agent, { status: 201 });
}
