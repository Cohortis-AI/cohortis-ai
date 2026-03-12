import { NextResponse } from "next/server";
import { getEffectiveSession } from "@/lib/auth-utils";
import { requireWorkspaceAccess } from "@/lib/workspace/auth";
import { db } from "@/lib/db/index";
import { agentMessages, agents } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";

const VALID_TYPES = ["delegation", "report", "prompt_update", "broadcast"] as const;

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
  const agentId = url.searchParams.get("agentId");
  const typeParam = url.searchParams.get("type");
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 200);
  const offset = parseInt(url.searchParams.get("offset") || "0");

  // Build conditions array
  const conditions = [eq(agentMessages.workspaceId, workspaceId)];

  if (agentId) {
    conditions.push(eq(agentMessages.senderAgentId, agentId));
  }

  if (typeParam && VALID_TYPES.includes(typeParam as any)) {
    conditions.push(eq(agentMessages.type, typeParam as any));
  }

  const results = await db
    .select({
      message: agentMessages,
      senderName: agents.name,
      senderType: agents.type,
    })
    .from(agentMessages)
    .leftJoin(agents, eq(agentMessages.senderAgentId, agents.id))
    .where(and(...conditions))
    .orderBy(desc(agentMessages.createdAt))
    .limit(limit)
    .offset(offset);

  return NextResponse.json(results);
}
