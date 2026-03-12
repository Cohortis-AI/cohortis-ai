import { generateText } from "ai";
import type { CoreMessage, ToolSet } from "ai";
import { getModel, safeModelId, estimateCostUsd } from "@/lib/ai/providers";
import {
  createAgentRun,
  updateAgentRun,
  incrementAgentTaskCount,
  getSubAgents,
  getAgentById,
  createAbTestRun,
  updatePromptVariant,
  getActiveVariantsByAgent,
} from "@/lib/db/queries";
import { createHierarchyTools } from "@/lib/agents/hierarchy-tools";
import { getWorkspaceContext } from "@/lib/workspace/context";
import { notificationBus } from "@/lib/notifications/event-bus";
import { pickActiveVariant } from "@/lib/agents/ab-selector";
import { checkAndAutoDeploy } from "@/lib/agents/ab-deploy";
import { checkBudget, recordSpend } from "@/lib/agents/budget";
import { executeExternalAgent } from "@/lib/agents/external-executor";
import type { agents } from "@/lib/db/schema";

type Agent = typeof agents.$inferSelect;

const MAX_STEPS = 50;
const MAX_HISTORY_MESSAGES = 20;
const TOOL_RESULT_MAX_LENGTH = 4000;

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ExecuteParams {
  agent: Agent;
  task: string;
  workspaceId: string;
  history?: ConversationMessage[];
  userTimezone?: string;
  delegationDepth?: number;
  initiatedBy?: string;
  parentRunId?: string;
  callbacks?: {
    onProgress?: (event: string, data: unknown) => void;
  };
}

export async function executeAgentTask(params: ExecuteParams) {
  const {
    agent,
    task,
    workspaceId,
    history,
    userTimezone,
    delegationDepth = 0,
    initiatedBy,
    parentRunId,
    callbacks,
  } = params;

  // Check agent budget before executing
  const budgetCheck = await checkBudget(agent.id);
  if (!budgetCheck.allowed) {
    return {
      runId: "",
      status: "failed" as const,
      error: budgetCheck.reason || "Agent budget exhausted",
      durationMs: 0,
    };
  }

  // Route external agents to webhook executor
  if (agent.runtime === "external" && agent.webhookUrl) {
    return executeExternalAgent({
      agent,
      task,
      workspaceId,
      initiatedBy,
      parentRunId,
      delegationDepth,
    });
  }

  const startTime = Date.now();
  const runId = crypto.randomUUID();

  // Pick A/B variant
  const variant = await pickActiveVariant(agent.id, runId);

  // Create run record
  const run = await createAgentRun({
    workspaceId,
    agentId: agent.id,
    initiatedBy,
    task: task.slice(0, 500),
    status: "running",
    variantId: variant.variantId,
    delegationDepth,
    parentRunId,
  });

  try {
    // Load workspace context for shared memory
    const wsContext = await getWorkspaceContext(workspaceId);

    // Load hierarchy context
    const [subAgentsList, parentAgentInfo] = await Promise.all([
      getSubAgents(agent.id, workspaceId),
      agent.parentAgentId
        ? getAgentById(agent.parentAgentId)
        : Promise.resolve(null),
    ]);

    // Build system prompt
    const effectivePrompt = variant.systemPrompt || agent.systemPrompt || "";
    const systemPrompt = buildSystemPrompt(
      agent,
      effectivePrompt,
      wsContext.sharedMemory,
      {
        subAgents: subAgentsList.map((s) => ({
          id: s.id,
          name: s.name,
          type: s.type,
          role: s.role,
          description: s.description,
          isActive: s.isActive,
        })),
        parentAgent: parentAgentInfo
          ? {
              id: parentAgentInfo.id,
              name: parentAgentInfo.name,
              role: parentAgentInfo.role,
            }
          : null,
      },
      userTimezone
    );

    // Build tools
    const hierarchyTools = createHierarchyTools(
      agent,
      userTimezone,
      delegationDepth
    );
    const tools: ToolSet = { ...hierarchyTools };

    // Build messages
    const historyMessages: CoreMessage[] = (history || [])
      .slice(-MAX_HISTORY_MESSAGES)
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

    let messages: CoreMessage[] = [
      ...historyMessages,
      { role: "user", content: task },
    ];

    let finalText = "";
    let totalTokens = 0;
    const allToolCalls: { name: string; arguments: unknown }[] = [];

    for (let step = 0; step < MAX_STEPS; step++) {
      const result = await generateText({
        model: getModel(safeModelId(agent.model)),
        system: systemPrompt,
        messages,
        tools,
      });

      const stepToolCalls = result.steps
        .flatMap((s) => s.toolCalls || [])
        .map((tc) => ({ name: tc.toolName, arguments: tc.args }));
      allToolCalls.push(...stepToolCalls);

      if (result.text) finalText = result.text;
      totalTokens += result.usage?.totalTokens || 0;

      if (result.finishReason !== "tool-calls") break;

      // Truncate large tool results
      const responseMessages = (
        result.response.messages as CoreMessage[]
      ).map((msg) => truncateLargeToolResults(msg));
      messages = [...messages, ...responseMessages];
    }

    const durationMs = Date.now() - startTime;
    const costUsd = estimateCostUsd(
      totalTokens,
      safeModelId(agent.model)
    );

    // Record spend against budget
    if (costUsd > 0) {
      recordSpend(agent.id, costUsd).catch(() => {});
    }

    // Update run record
    await updateAgentRun(run.id, {
      status: "completed",
      completedAt: new Date(),
      durationMs,
      resultSummary: finalText?.slice(0, 1000) || "Task completed",
      resultFull: finalText,
      toolCalls: allToolCalls.map((tc) => ({
        id: crypto.randomUUID(),
        name: tc.name,
        arguments: tc.arguments,
        startedAt: new Date().toISOString(),
      })),
      tokensUsed: totalTokens,
      estimatedCostUsd: costUsd.toFixed(6),
    });

    // Update agent metrics
    await incrementAgentTaskCount(agent.id, true);

    // Update A/B variant stats and check for auto-deploy
    if (variant.variantId) {
      await updateVariantStats(variant.variantId, agent.id, run.id, {
        success: true,
        durationMs,
        tokensUsed: totalTokens,
      });
      // Check if a variant should be auto-deployed
      checkAndAutoDeploy(agent.id).catch(() => {});
    }

    notificationBus.emitNotificationUpdate(agent.userId);

    return {
      runId: run.id,
      status: "completed" as const,
      result: finalText,
      toolCalls: allToolCalls,
      durationMs,
      tokensUsed: totalTokens,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    await updateAgentRun(run.id, {
      status: "failed",
      completedAt: new Date(),
      durationMs,
      errorMessage,
    });

    await incrementAgentTaskCount(agent.id, false);

    if (variant.variantId) {
      await updateVariantStats(variant.variantId, agent.id, run.id, {
        success: false,
        durationMs,
        tokensUsed: 0,
      });
      checkAndAutoDeploy(agent.id).catch(() => {});
    }

    notificationBus.emitNotificationUpdate(agent.userId);

    return {
      runId: run.id,
      status: "failed" as const,
      error: errorMessage,
      durationMs,
    };
  }
}

// ─── A/B Variant Stats ───

async function updateVariantStats(
  variantId: string,
  agentId: string,
  runId: string,
  result: {
    success: boolean;
    durationMs: number;
    tokensUsed: number;
  }
) {
  try {
    await createAbTestRun({
      variantId,
      runId,
      agentId,
      outcome: result.success ? "success" : "failure",
      durationMs: result.durationMs,
      tokensUsed: result.tokensUsed,
    });

    // Fetch current variant stats to compute new averages
    const variants = await getActiveVariantsByAgent(agentId);
    const variant = variants.find((v) => v.id === variantId);
    if (!variant) return;

    const newTotalRuns = (variant.totalRuns || 0) + 1;
    const newSuccessRuns = (variant.successRuns || 0) + (result.success ? 1 : 0);
    const newAvgDuration = Math.round(
      ((variant.avgDurationMs || 0) * (variant.totalRuns || 0) +
        result.durationMs) /
        newTotalRuns
    );

    const successRate = newSuccessRuns / Math.max(newTotalRuns, 1);
    const speedScore = 1 / Math.max(newAvgDuration / 1000, 1);
    const score = ((successRate * 0.7 + speedScore * 0.3) * 100).toFixed(2);

    await updatePromptVariant(variantId, {
      totalRuns: newTotalRuns,
      successRuns: newSuccessRuns,
      avgDurationMs: newAvgDuration,
      score,
    });
  } catch (err) {
    console.error("[Executor] Failed to update variant stats:", err);
  }
}

// ─── System Prompt Builder ───

interface HierarchyContext {
  subAgents: Array<{
    id: string;
    name: string;
    type: string | null;
    role: string | null;
    description: string | null;
    isActive: boolean | null;
  }>;
  parentAgent: { id: string; name: string; role: string | null } | null;
}

function buildSystemPrompt(
  agent: Agent,
  effectivePrompt: string,
  sharedMemory: { mission: string; teamContext: string; orgContext: string },
  hierarchy: HierarchyContext,
  userTimezone?: string
): string {
  const hierarchyBlock = buildHierarchyBlock(hierarchy);
  const memoryBlock = buildMemoryBlock(sharedMemory);

  return `You are "${agent.name}", an AI agent in the Cohortis AI platform.

<agent_context>
  <type>${agent.type || "general"}</type>
  <role>${agent.role || "General purpose agent"}</role>
  <date>${new Date().toISOString()}</date>
  <timezone>${userTimezone || "UTC"}</timezone>
</agent_context>

${effectivePrompt ? `<custom_instructions>\n${effectivePrompt}\n</custom_instructions>` : ""}

${memoryBlock}

${hierarchyBlock}

<instructions>
  Execute the task described in the user message using the available tools.
  Be concise and efficient. Complete the task and provide a brief summary.

  AGENT HIERARCHY:
  - If you have sub-agents, use delegate_to_sub_agent to assign tasks matching their specialty.
  - If you have a parent agent, use report_to_parent to send results and status updates.
  - If a sub-agent produces poor results, use update_sub_agent_prompt to improve their instructions.
  - Use list_sub_agents to check your team's status before delegating.
</instructions>`;
}

function buildHierarchyBlock(hierarchy: HierarchyContext): string {
  const parts: string[] = [];

  if (hierarchy.parentAgent) {
    parts.push(
      `<parent_agent>You report to "${hierarchy.parentAgent.name}" (ID: ${hierarchy.parentAgent.id}). Use report_to_parent to send results.</parent_agent>`
    );
  }

  if (hierarchy.subAgents.length > 0) {
    const subList = hierarchy.subAgents
      .map(
        (s) =>
          `  - "${s.name}" (ID: ${s.id}) | Type: ${s.type || "general"} | ${s.isActive ? "Active" : "PAUSED"} | ${s.description || "No description"}`
      )
      .join("\n");
    parts.push(
      `<sub_agents>\nYou manage the following sub-agents:\n${subList}\n</sub_agents>`
    );
  }

  if (parts.length === 0) return "";
  return `<hierarchy>\n${parts.join("\n\n")}\n</hierarchy>`;
}

function buildMemoryBlock(sharedMemory: {
  mission: string;
  teamContext: string;
  orgContext: string;
}): string {
  if (
    !sharedMemory.mission &&
    !sharedMemory.teamContext &&
    !sharedMemory.orgContext
  ) {
    return "";
  }

  return `<workspace_context>
${sharedMemory.mission ? `<mission>${sharedMemory.mission}</mission>` : ""}
${sharedMemory.teamContext ? `<team_context>${sharedMemory.teamContext}</team_context>` : ""}
${sharedMemory.orgContext ? `<org_context>${sharedMemory.orgContext}</org_context>` : ""}
</workspace_context>`;
}

// ─── Tool Result Truncation ───

function truncateLargeToolResults(msg: CoreMessage): CoreMessage {
  if (msg.role !== "tool") return msg;
  if (!Array.isArray(msg.content)) return msg;

  return {
    ...msg,
    content: msg.content.map((part: any) => {
      if (part.type === "tool-result" && part.result != null) {
        return { ...part, result: truncateDeep(part.result) };
      }
      if (
        typeof part.text === "string" &&
        part.text.length > TOOL_RESULT_MAX_LENGTH
      ) {
        return { ...part, text: truncateString(part.text) };
      }
      return part;
    }),
  } as CoreMessage;
}

function truncateDeep(value: unknown): unknown {
  if (typeof value === "string") return truncateString(value);
  if (Array.isArray(value)) return value.map(truncateDeep);
  if (typeof value === "object" && value !== null) {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = truncateDeep(v);
    }
    return result;
  }
  return value;
}

function truncateString(text: string): string {
  if (text.length <= TOOL_RESULT_MAX_LENGTH) return text;
  const base64Pattern = /[A-Za-z0-9+/]{200,}={0,2}/;
  if (base64Pattern.test(text)) {
    const sizeKB = Math.round((text.length * 3) / 4 / 1024);
    return `[binary data: ~${sizeKB}KB — truncated]`;
  }
  return (
    text.slice(0, TOOL_RESULT_MAX_LENGTH) +
    `\n...[truncated, ${text.length} chars total]`
  );
}
