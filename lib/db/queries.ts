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
  goals,
  heartbeats,
  agentBudgets,
  approvalGates,
} from "./schema";
import { eq, and, desc, asc, sql, count, lte } from "drizzle-orm";

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
  runtime?: string;
  webhookUrl?: string | null;
  webhookSecret?: string | null;
  webhookHeaders?: Record<string, string> | null;
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
      runtime: data.runtime || "internal",
      webhookUrl: data.webhookUrl || null,
      webhookSecret: data.webhookSecret || null,
      webhookHeaders: data.webhookHeaders || null,
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
    runtime: string;
    webhookUrl: string | null;
    webhookSecret: string | null;
    webhookHeaders: Record<string, string> | null;
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

// ─── Goals ───

export async function getGoalsByWorkspace(workspaceId: string) {
  return db
    .select()
    .from(goals)
    .where(eq(goals.workspaceId, workspaceId))
    .orderBy(desc(goals.priority), asc(goals.createdAt));
}

export async function getGoalById(id: string) {
  const [goal] = await db.select().from(goals).where(eq(goals.id, id));
  return goal ?? null;
}

export async function getSubGoals(parentGoalId: string) {
  return db
    .select()
    .from(goals)
    .where(eq(goals.parentGoalId, parentGoalId))
    .orderBy(desc(goals.priority), asc(goals.createdAt));
}

export async function createGoal(data: {
  workspaceId: string;
  title: string;
  description?: string | null;
  parentGoalId?: string | null;
  assignedAgentId?: string | null;
  status?: string;
  priority?: number;
  dueAt?: Date | null;
  progress?: number;
}) {
  const [goal] = await db
    .insert(goals)
    .values({
      workspaceId: data.workspaceId,
      title: data.title,
      description: data.description || null,
      parentGoalId: data.parentGoalId || null,
      assignedAgentId: data.assignedAgentId || null,
      status: (data.status as any) || "active",
      priority: data.priority ?? 0,
      dueAt: data.dueAt || null,
      progress: data.progress ?? 0,
    })
    .returning();
  return goal;
}

export async function updateGoal(
  id: string,
  data: Partial<{
    title: string;
    description: string | null;
    parentGoalId: string | null;
    assignedAgentId: string | null;
    status: string;
    priority: number;
    dueAt: Date | null;
    completedAt: Date | null;
    progress: number;
  }>
) {
  const [goal] = await db
    .update(goals)
    .set({ ...data, updatedAt: new Date() } as any)
    .where(eq(goals.id, id))
    .returning();
  return goal;
}

export async function deleteGoal(id: string) {
  await db.delete(goals).where(eq(goals.id, id));
}

// ─── Heartbeats ───

const FREQUENCY_MS: Record<string, number> = {
  "5m": 5 * 60 * 1000,
  "15m": 15 * 60 * 1000,
  "30m": 30 * 60 * 1000,
  "1h": 60 * 60 * 1000,
  "4h": 4 * 60 * 60 * 1000,
  "12h": 12 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
};

export async function getHeartbeatsByWorkspace(workspaceId: string) {
  return db
    .select()
    .from(heartbeats)
    .where(eq(heartbeats.workspaceId, workspaceId))
    .orderBy(asc(heartbeats.createdAt));
}

export async function getHeartbeatsByAgent(agentId: string) {
  return db
    .select()
    .from(heartbeats)
    .where(eq(heartbeats.agentId, agentId))
    .orderBy(asc(heartbeats.createdAt));
}

export async function getHeartbeatById(id: string) {
  const [heartbeat] = await db
    .select()
    .from(heartbeats)
    .where(eq(heartbeats.id, id));
  return heartbeat ?? null;
}

export async function getDueHeartbeats() {
  return db
    .select()
    .from(heartbeats)
    .where(
      and(
        eq(heartbeats.isEnabled, true),
        lte(heartbeats.nextRunAt, new Date())
      )
    );
}

export async function createHeartbeat(data: {
  workspaceId: string;
  agentId: string;
  task: string;
  frequency?: string;
  isEnabled?: boolean;
}) {
  const freq = data.frequency || "1h";
  const intervalMs = FREQUENCY_MS[freq] || FREQUENCY_MS["1h"];
  const nextRunAt = new Date(Date.now() + intervalMs);

  const [heartbeat] = await db
    .insert(heartbeats)
    .values({
      workspaceId: data.workspaceId,
      agentId: data.agentId,
      task: data.task,
      frequency: freq as any,
      isEnabled: data.isEnabled ?? true,
      nextRunAt,
    })
    .returning();
  return heartbeat;
}

export async function updateHeartbeat(
  id: string,
  data: Partial<{
    task: string;
    frequency: string;
    isEnabled: boolean;
    nextRunAt: Date;
  }>
) {
  const [heartbeat] = await db
    .update(heartbeats)
    .set({ ...data, updatedAt: new Date() } as any)
    .where(eq(heartbeats.id, id))
    .returning();
  return heartbeat;
}

export async function deleteHeartbeat(id: string) {
  await db.delete(heartbeats).where(eq(heartbeats.id, id));
}

export async function markHeartbeatRun(
  id: string,
  status: string,
  result: string | null
) {
  const heartbeat = await getHeartbeatById(id);
  if (!heartbeat) throw new Error("Heartbeat not found");

  const freq = heartbeat.frequency || "1h";
  const intervalMs = FREQUENCY_MS[freq] || FREQUENCY_MS["1h"];
  const nextRunAt = new Date(Date.now() + intervalMs);

  const [updated] = await db
    .update(heartbeats)
    .set({
      lastRunAt: new Date(),
      lastStatus: status,
      lastResult: result,
      totalRuns: sql`${heartbeats.totalRuns} + 1`,
      nextRunAt,
      updatedAt: new Date(),
    })
    .where(eq(heartbeats.id, id))
    .returning();
  return updated;
}

// ─── Agent Budgets ───

export async function getBudgetByAgent(agentId: string) {
  const [budget] = await db
    .select()
    .from(agentBudgets)
    .where(eq(agentBudgets.agentId, agentId));
  return budget ?? null;
}

export async function getBudgetsByWorkspace(workspaceId: string) {
  return db
    .select({
      budget: agentBudgets,
      agentName: agents.name,
    })
    .from(agentBudgets)
    .innerJoin(agents, eq(agentBudgets.agentId, agents.id))
    .where(eq(agentBudgets.workspaceId, workspaceId))
    .orderBy(asc(agentBudgets.createdAt));
}

export async function getBudgetById(id: string) {
  const [budget] = await db
    .select()
    .from(agentBudgets)
    .where(eq(agentBudgets.id, id));
  return budget ?? null;
}

export async function createBudget(data: {
  workspaceId: string;
  agentId: string;
  monthlyLimitUsd: string;
  warningThreshold?: number;
}) {
  const now = new Date();
  const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [budget] = await db
    .insert(agentBudgets)
    .values({
      workspaceId: data.workspaceId,
      agentId: data.agentId,
      monthlyLimitUsd: data.monthlyLimitUsd,
      warningThreshold: data.warningThreshold ?? 80,
      periodStart: now,
      periodEnd,
    })
    .returning();
  return budget;
}

export async function updateBudget(
  id: string,
  data: Partial<{
    monthlyLimitUsd: string;
    warningThreshold: number;
    isThrottled: boolean;
    currentSpendUsd: string;
    periodStart: Date;
    periodEnd: Date;
  }>
) {
  const [budget] = await db
    .update(agentBudgets)
    .set({ ...data, updatedAt: new Date() } as any)
    .where(eq(agentBudgets.id, id))
    .returning();
  return budget;
}

export async function deleteBudget(id: string) {
  await db.delete(agentBudgets).where(eq(agentBudgets.id, id));
}

export async function addSpendToBudget(agentId: string, amountUsd: string) {
  const budget = await getBudgetByAgent(agentId);
  if (!budget) return null;

  const newSpend = parseFloat(budget.currentSpendUsd) + parseFloat(amountUsd);
  const limit = parseFloat(budget.monthlyLimitUsd);
  const isThrottled = newSpend >= limit;

  const [updated] = await db
    .update(agentBudgets)
    .set({
      currentSpendUsd: sql`${agentBudgets.currentSpendUsd}::numeric + ${amountUsd}::numeric`,
      isThrottled,
      updatedAt: new Date(),
    })
    .where(eq(agentBudgets.agentId, agentId))
    .returning();
  return updated;
}

export async function resetBudgetPeriod(id: string) {
  const budget = await getBudgetById(id);
  if (!budget) throw new Error("Budget not found");

  const newPeriodStart = new Date(budget.periodEnd);
  const newPeriodEnd = new Date(
    newPeriodStart.getTime() + 30 * 24 * 60 * 60 * 1000
  );

  const [updated] = await db
    .update(agentBudgets)
    .set({
      currentSpendUsd: "0",
      isThrottled: false,
      periodStart: newPeriodStart,
      periodEnd: newPeriodEnd,
      updatedAt: new Date(),
    })
    .where(eq(agentBudgets.id, id))
    .returning();
  return updated;
}

// ─── Approval Gates ───

export async function getApprovalsByWorkspace(
  workspaceId: string,
  options?: { status?: string; limit?: number }
) {
  let query = db
    .select({
      approval: approvalGates,
      agentName: agents.name,
    })
    .from(approvalGates)
    .innerJoin(agents, eq(approvalGates.agentId, agents.id))
    .where(
      options?.status
        ? and(
            eq(approvalGates.workspaceId, workspaceId),
            eq(approvalGates.status, options.status as any)
          )
        : eq(approvalGates.workspaceId, workspaceId)
    )
    .orderBy(desc(approvalGates.requestedAt));

  if (options?.limit) {
    query = query.limit(options.limit) as any;
  }

  return query;
}

export async function getPendingApprovals(workspaceId: string) {
  return getApprovalsByWorkspace(workspaceId, { status: "pending" });
}

export async function getApprovalById(id: string) {
  const [approval] = await db
    .select()
    .from(approvalGates)
    .where(eq(approvalGates.id, id));
  return approval ?? null;
}

export async function createApproval(data: {
  workspaceId: string;
  agentId: string;
  action: string;
  actionType: string;
  runId?: string | null;
  metadata?: unknown;
}) {
  const [approval] = await db
    .insert(approvalGates)
    .values({
      workspaceId: data.workspaceId,
      agentId: data.agentId,
      action: data.action,
      actionType: data.actionType,
      runId: data.runId || null,
      metadata: data.metadata || null,
    } as any)
    .returning();
  return approval;
}

export async function reviewApproval(
  id: string,
  data: {
    status: "approved" | "rejected";
    reviewedBy: string;
    reviewNote?: string;
  }
) {
  const [approval] = await db
    .update(approvalGates)
    .set({
      status: data.status,
      reviewedBy: data.reviewedBy,
      reviewedAt: new Date(),
      reviewNote: data.reviewNote || null,
    } as any)
    .where(eq(approvalGates.id, id))
    .returning();
  return approval;
}
