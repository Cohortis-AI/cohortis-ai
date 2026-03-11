import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { getAgentRunsByWorkspace } from "@/lib/db/queries";
import { requireWorkspaceAccess } from "@/lib/workspace/auth";

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

  const runs = await getAgentRunsByWorkspace(workspaceId, { limit: 50 });
  return NextResponse.json(runs);
}
