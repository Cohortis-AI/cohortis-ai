import { db } from "@/lib/db";
import { agents, agentRuns, workspaces } from "@/lib/db/schema";
import { eq, and, sql, count } from "drizzle-orm";

interface PlanLimits {
  maxAgents: number;
  maxDepth: number;
  maxRunsPerMonth: number;
}

export const PLAN_LIMITS: Record<string, PlanLimits> = {
  starter: { maxAgents: 5, maxDepth: 3, maxRunsPerMonth: 500 },
  team: { maxAgents: 25, maxDepth: 3, maxRunsPerMonth: 5000 },
  enterprise: { maxAgents: Infinity, maxDepth: 5, maxRunsPerMonth: Infinity },
};

export async function getWorkspacePlan(workspaceId: string) {
  const [workspace] = await db
    .select({ plan: workspaces.plan })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId));
  return workspace?.plan || "starter";
}

export async function checkAgentLimit(workspaceId: string) {
  const plan = await getWorkspacePlan(workspaceId);
  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.starter;

  const [result] = await db
    .select({ count: count() })
    .from(agents)
    .where(eq(agents.workspaceId, workspaceId));

  const current = result?.count || 0;

  return {
    allowed: current < limits.maxAgents,
    current,
    limit: limits.maxAgents,
    plan,
  };
}

export async function checkRunLimit(workspaceId: string) {
  const plan = await getWorkspacePlan(workspaceId);
  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.starter;

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [result] = await db
    .select({ count: count() })
    .from(agentRuns)
    .where(
      and(
        eq(agentRuns.workspaceId, workspaceId),
        sql`${agentRuns.createdAt} >= ${thirtyDaysAgo}`
      )
    );

  const current = result?.count || 0;

  return {
    allowed: current < limits.maxRunsPerMonth,
    current,
    limit: limits.maxRunsPerMonth,
    plan,
  };
}
