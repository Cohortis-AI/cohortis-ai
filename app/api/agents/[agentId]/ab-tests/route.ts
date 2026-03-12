import { NextResponse } from "next/server";
import { getEffectiveSession } from "@/lib/auth-utils";
import {
  getAgentById,
  getVariantsByAgent,
  createPromptVariant,
} from "@/lib/db/queries";
import { requireWorkspaceAccess } from "@/lib/workspace/auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const session = await getEffectiveSession();
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

  const variants = await getVariantsByAgent(agentId);
  return NextResponse.json(variants);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const session = await getEffectiveSession();
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
  const { name, systemPrompt, isControl } = body;

  if (!name || !systemPrompt) {
    return NextResponse.json(
      { error: "name and systemPrompt required" },
      { status: 400 }
    );
  }

  const variant = await createPromptVariant({
    agentId,
    workspaceId: agent.workspaceId,
    name,
    systemPrompt,
    isControl: isControl || false,
  });

  return NextResponse.json(variant, { status: 201 });
}
