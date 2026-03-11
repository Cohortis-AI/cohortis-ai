import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { getAgentById, getAgentRunsByAgent } from "@/lib/db/queries";
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

  const runs = await getAgentRunsByAgent(agentId);
  return NextResponse.json(runs);
}
