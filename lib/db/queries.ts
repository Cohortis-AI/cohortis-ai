import { db } from "./index";
import {
  users,
  workspaces,
  workspaceMembers,
  agents,
  agentRuns,
  promptVariants,
  abTestRuns,
  agentMessages,
  integrations,
} from "./schema";
import { eq, and, desc, asc, sql, count } from "drizzle-orm";

// ─── Users ───

export async function getUserById(id: string) {
  const [user] = await db.select().from(users).where(eq(users.id, id));
  return user ?? null;
}

export async function getUserByEmail(email: string) {
  const [user] = await db.select().from(users).where(eq(users.email, email));
  return user ?? null;
}

// ─── Workspaces ───

export async function getWorkspacesByUserId(userId: string) {
  const memberships = await db
    .select({
      workspace: workspaces,
      role: workspaceMembers.role,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(eq(workspaceMembers.userId, userId))
    .orderBy(desc(workspaces.createdAt));

  return memberships;
}

export async function getWorkspaceById(id: string) {
  const [workspace] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, id));
  return workspace ?? null;
}

export async function getWorkspaceBySlug(slug: string) {
  const [workspace] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.slug, slug));
  return workspace ?? null;
}

export async function createWorkspace(data: {
  name: string;
  slug: string;
  ownerId: string;
  plan?: string;
}) {
  const [workspace] = await db
    .insert(workspaces)
    .values({
      name: data.name,
      slug: data.slug,
      ownerId: data.ownerId,
      plan: data.plan || "starter",
    })
    .returning();

  // Auto-add owner as member
  await db.insert(workspaceMembers).values({
    workspaceId: workspace.id,
    userId: data.ownerId,
    role: "owner",
    joinedAt: new Date(),
  });

  return workspace;
}

export async function updateWorkspace(
  id: string,
  data: Partial<{
    name: string;
    slug: string;
    plan: string;
    sharedMemory: { mission: string; teamContext: string; orgContext: string };
    settings: {
      maxAgents: number;
      maxDepth: number;
      allowMemberExecution: boolean;
    };
  }>
) {
  const [workspace] = await db
    .update(workspaces)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(workspaces.id, id))
    .returning();
  return workspace;
}

export async function deleteWorkspace(id: string) {
  await db.delete(workspaces).where(eq(workspaces.id, id));
}

// ─── Workspace Members ───

export async function getWorkspaceMembers(workspaceId: string) {
  return db
    .select({
      member: workspaceMembers,
      user: users,
    })
    .from(workspaceMembers)
    .innerJoin(users, eq(workspaceMembers.userId, users.id))
    .where(eq(workspaceMembers.workspaceId, workspaceId))
    .orderBy(asc(workspaceMembers.joinedAt));
}

export async function getWorkspaceMember(workspaceId: string, userId: string) {
  const [member] = await db
    .select()
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, userId)
      )
    );
  return member ?? null;
}

export async function addWorkspaceMember(data: {
  workspaceId: string;
  userId: string;
  role?: "owner" | "admin" | "member" | "viewer";
  invitedBy?: string;
}) {
  const [member] = await db
    .insert(workspaceMembers)
    .values({
      workspaceId: data.workspaceId,
      userId: data.userId,
      role: data.role || "member",
      invitedBy: data.invitedBy,
      invitedAt: new Date(),
      joinedAt: new Date(),
    })
    .returning();
  return member;
}

export async function removeWorkspaceMember(
  workspaceId: string,
  userId: string
) {
  await db
    .delete(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, userId)
      )
    );
}

// ─── Agents ───

export async function getAgentsByWorkspace(workspaceId: string) {
  return db
    .select()
    .from(agents)
    .where(eq(agents.workspaceId, workspaceId))
    .orderBy(asc(agents.createdAt));
}

export async function getAgentById(id: string) {
  const [agent] = await db.select().from(agents).where(eq(agents.id, id));
  return agent ?? null;
}

export async function getSubAgents(parentId: string, workspaceId: string) {
  return db
    .select()
    .from(agents)
    .where(
      and(
        eq(agents.parentAgentId, parentId),
        eq(agents.workspaceId, workspaceId)
      )
    )
    .orderBy(asc(agents.name));
}

export async function createAgent(data: {
  workspaceId: string;
  userId: string;
  name: string;
  description?: string | null;
  type?: string;
  icon?: string | null;
  role?: string | null;
  parentAgentId?: string | null;
  systemPrompt?: string | null;
  capabilities?: string[];
  model?: string;
  provider?: string;
  customSkills?: Array<{
    id: string;
    name: string;
    description: string;
    instructions: string;
    category?: string;
  }> | null;
  knowledgeFiles?: Array<{
    id: string;
    name: string;
    content: string;
    addedAt: string;
  }> | null;
  conversationStarters?: string[] | null;
  isActive?: boolean;
}) {
  const [agent] = await db
    .insert(agents)
    .values({
      workspaceId: data.workspaceId,
      userId: data.userId,
      name: data.name,
      description: data.description || null,
      type: (data.type as any) || "general",
      icon: data.icon || null,
      role: data.role || null,
      parentAgentId: data.parentAgentId || null,
      systemPrompt: data.systemPrompt || null,
      capabilities: data.capabilities || [],
      model: data.model || "gpt-5.2",
      provider: data.provider || "openai",
      customSkills: data.customSkills || null,
      knowledgeFiles: data.knowledgeFiles || null,
      conversationStarters: data.conversationStarters || null,
      isActive: data.isActive ?? true,
    })
    .returning();
  return agent;
}

export async function updateAgent(
  id: string,
  data: Partial<{
    name: string;
    description: string | null;
    type: string;
    icon: string | null;
    role: string | null;
    parentAgentId: string | null;
    systemPrompt: string | null;
    capabilities: string[];
    model: string;
    provider: string;
    customSkills: Array<{
      id: string;
      name: string;
      description: string;
      instructions: string;
      category?: string;
    }> | null;
    knowledgeFiles: Array<{
      id: string;
      name: string;
      content: string;
      addedAt: string;
    }> | null;
    conversationStarters: string[] | null;
    promptHistory: Array<{
      previousPrompt: string | null;
      newPrompt: string;
      modifiedBy: string;
      reason: string;
      timestamp: string;
    }>;
    activeVariantId: string | null;
    isActive: boolean;
    lastActiveAt: Date;
    totalTasksCompleted: number;
    totalTasksFailed: number;
    averageExecutionTime: number;
  }>
) {
  const [agent] = await db
    .update(agents)
    .set({ ...data, updatedAt: new Date() } as any)
    .where(eq(agents.id, id))
    .returning();
  return agent;
}

export async function deleteAgent(id: string) {
  await db.delete(agents).where(eq(agents.id, id));
}

export async function incrementAgentTaskCount(
  agentId: string,
  success: boolean
) {
  if (success) {
    await db
      .update(agents)
      .set({
        totalTasksCompleted: sql`${agents.totalTasksCompleted} + 1`,
        lastActiveAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(agents.id, agentId));
  } else {
    await db
      .update(agents)
      .set({
        totalTasksFailed: sql`${agents.totalTasksFailed} + 1`,
        lastActiveAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(agents.id, agentId));
  }
}

export async function updateAgentPromptWithHistory(
  agentId: string,
  newPrompt: string,
  modifiedBy: string,
  reason: string
) {
  const agent = await getAgentById(agentId);
  if (!agent) throw new Error("Agent not found");

  const historyEntry = {
    previousPrompt: agent.systemPrompt,
    newPrompt,
    modifiedBy,
    reason,
    timestamp: new Date().toISOString(),
  };

  const existingHistory = agent.promptHistory || [];

  return updateAgent(agentId, {
    systemPrompt: newPrompt,
    promptHistory: [...existingHistory, historyEntry],
  });
}

// ─── Agent Runs ───

export async function createAgentRun(data: {
  workspaceId: string;
  agentId: string;
  initiatedBy?: string;
  task: string;
  status?: string;
  variantId?: string | null;
  delegationDepth?: number;
  parentRunId?: string | null;
}) {
  const [run] = await db
    .insert(agentRuns)
    .values({
      workspaceId: data.workspaceId,
      agentId: data.agentId,
      initiatedBy: data.initiatedBy,
      task: data.task,
      status: (data.status as any) || "pending",
      variantId: data.variantId || null,
      delegationDepth: data.delegationDepth || 0,
      parentRunId: data.parentRunId || null,
      startedAt: new Date(),
    })
    .returning();
  return run;
}

export async function updateAgentRun(
  id: string,
  data: Partial<{
    status: string;
    completedAt: Date;
    durationMs: number;
    resultSummary: string;
    resultFull: string;
    toolCalls: Array<{
      id: string;
      name: string;
      arguments: unknown;
      startedAt: string;
    }>;
    tokensUsed: number;
    estimatedCostUsd: string;
    errorMessage: string;
  }>
) {
  const [run] = await db
    .update(agentRuns)
    .set(data as any)
    .where(eq(agentRuns.id, id))
    .returning();
  return run;
}

export async function getAgentRunsByWorkspace(
  workspaceId: string,
  options?: {
    agentId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }
) {
  let query = db
    .select()
    .from(agentRuns)
    .where(eq(agentRuns.workspaceId, workspaceId))
    .orderBy(desc(agentRuns.createdAt));

  if (options?.limit) {
    query = query.limit(options.limit) as any;
  }
  if (options?.offset) {
    query = query.offset(options.offset) as any;
  }

  return query;
}

export async function getAgentRunById(id: string) {
  const [run] = await db
    .select()
    .from(agentRuns)
    .where(eq(agentRuns.id, id));
  return run ?? null;
}

export async function getAgentRunsByAgent(
  agentId: string,
  limit: number = 20
) {
  return db
    .select()
    .from(agentRuns)
    .where(eq(agentRuns.agentId, agentId))
    .orderBy(desc(agentRuns.createdAt))
    .limit(limit);
}

// ─── Prompt Variants ───

export async function getVariantsByAgent(agentId: string) {
  return db
    .select()
    .from(promptVariants)
    .where(eq(promptVariants.agentId, agentId))
    .orderBy(desc(promptVariants.createdAt));
}

export async function getActiveVariantsByAgent(agentId: string) {
  return db
    .select()
    .from(promptVariants)
    .where(
      and(
        eq(promptVariants.agentId, agentId),
        eq(promptVariants.isActive, true)
      )
    );
}

export async function createPromptVariant(data: {
  agentId: string;
  workspaceId: string;
  name: string;
  systemPrompt: string;
  isControl?: boolean;
}) {
  const [variant] = await db
    .insert(promptVariants)
    .values({
      agentId: data.agentId,
      workspaceId: data.workspaceId,
      name: data.name,
      systemPrompt: data.systemPrompt,
      isControl: data.isControl || false,
    })
    .returning();
  return variant;
}

export async function updatePromptVariant(
  id: string,
  data: Partial<{
    name: string;
    systemPrompt: string;
    isActive: boolean;
    weight: number;
    totalRuns: number;
    successRuns: number;
    avgDurationMs: number;
    avgTokensUsed: number;
    score: string;
    deployedAt: Date;
  }>
) {
  const [variant] = await db
    .update(promptVariants)
    .set({ ...data, updatedAt: new Date() } as any)
    .where(eq(promptVariants.id, id))
    .returning();
  return variant;
}

// ─── A/B Test Runs ───

export async function createAbTestRun(data: {
  variantId: string;
  runId: string;
  agentId: string;
  outcome: "success" | "failure" | "partial";
  durationMs?: number;
  tokensUsed?: number;
}) {
  const [testRun] = await db
    .insert(abTestRuns)
    .values(data)
    .returning();
  return testRun;
}

// ─── Agent Messages ───

export async function createAgentMessage(data: {
  workspaceId: string;
  senderAgentId: string;
  receiverAgentId?: string;
  type: "delegation" | "report" | "prompt_update" | "broadcast";
  content: string;
  metadata?: unknown;
}) {
  const [message] = await db
    .insert(agentMessages)
    .values(data as any)
    .returning();
  return message;
}

export async function getAgentMessages(
  workspaceId: string,
  agentId: string,
  limit: number = 50
) {
  return db
    .select()
    .from(agentMessages)
    .where(
      and(
        eq(agentMessages.workspaceId, workspaceId),
        eq(agentMessages.senderAgentId, agentId)
      )
    )
    .orderBy(desc(agentMessages.createdAt))
    .limit(limit);
}

// ─── Integrations ───

export async function getIntegrationsByWorkspace(workspaceId: string) {
  return db
    .select()
    .from(integrations)
    .where(eq(integrations.workspaceId, workspaceId));
}

// ─── Dashboard Aggregations ───

export async function getWorkspaceDashboardStats(workspaceId: string) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [stats] = await db
    .select({
      totalRuns: count(),
      successRuns: sql<number>`count(*) filter (where ${agentRuns.status} = 'completed')`,
      failedRuns: sql<number>`count(*) filter (where ${agentRuns.status} = 'failed')`,
      avgDurationMs: sql<number>`avg(${agentRuns.durationMs})`,
      totalCostUsd: sql<number>`sum(${agentRuns.estimatedCostUsd}::numeric)`,
      totalTokens: sql<number>`sum(${agentRuns.tokensUsed})`,
    })
    .from(agentRuns)
    .where(
      and(
        eq(agentRuns.workspaceId, workspaceId),
        sql`${agentRuns.createdAt} >= ${thirtyDaysAgo}`
      )
    );

  const agentCount = await db
    .select({ count: count() })
    .from(agents)
    .where(eq(agents.workspaceId, workspaceId));

  return {
    ...stats,
    totalAgents: agentCount[0]?.count || 0,
  };
}
