import { NextResponse } from "next/server";
import { getEffectiveSession } from "@/lib/auth-utils";
import { getAgentById } from "@/lib/db/queries";
import { requireWorkspaceAccess } from "@/lib/workspace/auth";
import { db } from "@/lib/db/index";
import { agentRuns } from "@/lib/db/schema";
import { eq, and, sql, desc } from "drizzle-orm";

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

  // Get daily run stats for last 14 days
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  const dailyStats = await db
    .select({
      day: sql<string>`to_char(${agentRuns.createdAt}, 'YYYY-MM-DD')`,
      totalRuns: sql<number>`count(*)`,
      completedRuns: sql<number>`count(*) filter (where ${agentRuns.status} = 'completed')`,
      failedRuns: sql<number>`count(*) filter (where ${agentRuns.status} = 'failed')`,
      avgDurationMs: sql<number>`avg(${agentRuns.durationMs})`,
      totalTokens: sql<number>`sum(${agentRuns.tokensUsed})`,
      totalCost: sql<number>`sum(${agentRuns.estimatedCostUsd}::numeric)`,
    })
    .from(agentRuns)
    .where(
      and(
        eq(agentRuns.agentId, agentId),
        sql`${agentRuns.createdAt} >= ${fourteenDaysAgo}`
      )
    )
    .groupBy(sql`to_char(${agentRuns.createdAt}, 'YYYY-MM-DD')`)
    .orderBy(sql`to_char(${agentRuns.createdAt}, 'YYYY-MM-DD')`);

  // Get last 10 runs for sparkline
  const recentRuns = await db
    .select({
      id: agentRuns.id,
      status: agentRuns.status,
      durationMs: agentRuns.durationMs,
      tokensUsed: agentRuns.tokensUsed,
      createdAt: agentRuns.createdAt,
    })
    .from(agentRuns)
    .where(eq(agentRuns.agentId, agentId))
    .orderBy(desc(agentRuns.createdAt))
    .limit(10);

  return NextResponse.json({ dailyStats, recentRuns });
}
