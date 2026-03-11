import { tool } from "ai";
import type { ToolSet } from "ai";
import { z } from "zod";
import { executeAgentTask } from "@/lib/agents/executor";
import {
  getAgentById,
  getSubAgents,
  createAgentMessage,
  updateAgentPromptWithHistory,
} from "@/lib/db/queries";
import { notificationBus } from "@/lib/notifications/event-bus";
import type { agents } from "@/lib/db/schema";

type Agent = typeof agents.$inferSelect;

const MAX_PROMPT_UPDATES_PER_DAY = 5;
const MAX_DELEGATION_DEPTH = 3;

// Track prompt updates in-memory (resets on server restart)
const promptUpdateCounts = new Map<
  string,
  { count: number; resetAt: number }
>();

function checkPromptUpdateLimit(managerAgentId: string): boolean {
  const now = Date.now();
  const entry = promptUpdateCounts.get(managerAgentId);
  if (!entry || now > entry.resetAt) {
    promptUpdateCounts.set(managerAgentId, {
      count: 1,
      resetAt: now + 24 * 60 * 60 * 1000,
    });
    return true;
  }
  if (entry.count >= MAX_PROMPT_UPDATES_PER_DAY) return false;
  entry.count++;
  return true;
}

export function createHierarchyTools(
  agent: Agent,
  userTimezone?: string,
  currentDepth: number = 0
): ToolSet {
  const tools: ToolSet = {};

  tools.delegate_to_sub_agent = tool({
    description:
      "Delegate a task to one of your sub-agents. " +
      "The sub-agent will execute independently and return its result.",
    parameters: z.object({
      subAgentId: z.string().describe("The ID of the sub-agent to delegate to"),
      task: z.string().describe("The task description to delegate"),
      context: z
        .string()
        .describe("Additional context for the sub-agent. Pass empty string if none."),
    }),
    execute: async ({ subAgentId, task, context }) => {
      const subAgents = await getSubAgents(agent.id, agent.workspaceId);
      const subAgent = subAgents.find((s) => s.id === subAgentId);

      if (!subAgent) {
        return {
          error: "Not a sub-agent of yours.",
          yourSubAgents: subAgents.map((s) => ({
            id: s.id,
            name: s.name,
            type: s.type,
          })),
        };
      }

      if (!subAgent.isActive) {
        return { error: `Sub-agent "${subAgent.name}" is paused` };
      }

      if (currentDepth >= MAX_DELEGATION_DEPTH) {
        return {
          error: `Maximum delegation depth (${MAX_DELEGATION_DEPTH}) reached.`,
        };
      }

      const fullTask = context?.trim()
        ? `${task}\n\nContext from manager: ${context}`
        : task;

      await createAgentMessage({
        workspaceId: agent.workspaceId,
        senderAgentId: agent.id,
        receiverAgentId: subAgent.id,
        type: "delegation",
        content: fullTask,
        metadata: { delegatedBy: agent.name },
      });

      try {
        const result = await executeAgentTask({
          agent: subAgent,
          task: fullTask,
          workspaceId: agent.workspaceId,
          userTimezone,
          delegationDepth: currentDepth + 1,
        });

        await createAgentMessage({
          workspaceId: agent.workspaceId,
          senderAgentId: subAgent.id,
          receiverAgentId: agent.id,
          type: "report",
          content:
            result.status === "completed"
              ? (result.result || "Task completed").slice(0, 2000)
              : (result.error || "Task failed").slice(0, 2000),
          metadata: {
            runId: result.runId,
            status: result.status,
            durationMs: result.durationMs,
          },
        });

        return {
          subAgentName: subAgent.name,
          status: result.status,
          response:
            result.status === "completed" ? result.result : result.error,
          durationMs: result.durationMs,
        };
      } catch (err) {
        return {
          subAgentName: subAgent.name,
          status: "failed",
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
  });

  tools.report_to_parent = tool({
    description:
      "Send a report to your manager agent (the agent above you in the hierarchy).",
    parameters: z.object({
      report: z.string().describe("The report content"),
      status: z
        .enum(["success", "partial", "failed", "needs_attention"])
        .describe("Status of the work"),
    }),
    execute: async ({ report, status }) => {
      if (!agent.parentAgentId) {
        return { error: "You have no parent agent." };
      }

      const parentAgent = await getAgentById(agent.parentAgentId);
      if (!parentAgent || parentAgent.workspaceId !== agent.workspaceId) {
        return { error: "Parent agent not found." };
      }

      await createAgentMessage({
        workspaceId: agent.workspaceId,
        senderAgentId: agent.id,
        receiverAgentId: parentAgent.id,
        type: "report",
        content: report,
        metadata: { status, reportedBy: agent.name },
      });

      return {
        sent: true,
        parentAgentName: parentAgent.name,
        reportStatus: status,
      };
    },
  });

  tools.list_sub_agents = tool({
    description:
      "List all agents that report directly to you with their status.",
    parameters: z.object({}),
    execute: async () => {
      const subAgents = await getSubAgents(agent.id, agent.workspaceId);
      if (subAgents.length === 0) {
        return { subAgents: [], message: "You have no sub-agents." };
      }
      return {
        subAgents: subAgents.map((s) => ({
          id: s.id,
          name: s.name,
          type: s.type,
          role: s.role,
          description: s.description,
          isActive: s.isActive,
          totalTasksCompleted: s.totalTasksCompleted,
          totalTasksFailed: s.totalTasksFailed,
        })),
      };
    },
  });

  tools.update_sub_agent_prompt = tool({
    description:
      "Modify the system prompt of a sub-agent to improve performance. " +
      "Limited to 5 updates per day per manager.",
    parameters: z.object({
      subAgentId: z.string().describe("Sub-agent ID to modify"),
      newPrompt: z.string().describe("New system prompt"),
      reason: z.string().describe("Why you are changing this prompt"),
    }),
    execute: async ({ subAgentId, newPrompt, reason }) => {
      const subAgents = await getSubAgents(agent.id, agent.workspaceId);
      const subAgent = subAgents.find((s) => s.id === subAgentId);

      if (!subAgent) {
        return { error: "Not a sub-agent of yours." };
      }

      if (!checkPromptUpdateLimit(agent.id)) {
        return {
          error: `Daily prompt update limit reached (${MAX_PROMPT_UPDATES_PER_DAY}/day).`,
        };
      }

      if (newPrompt.trim().length < 20) {
        return { error: "Prompt too short (min 20 chars)." };
      }

      try {
        await updateAgentPromptWithHistory(
          subAgentId,
          newPrompt,
          agent.id,
          reason
        );

        await createAgentMessage({
          workspaceId: agent.workspaceId,
          senderAgentId: agent.id,
          receiverAgentId: subAgentId,
          type: "prompt_update",
          content: `Prompt updated by "${agent.name}". Reason: ${reason}`,
          metadata: {
            previousPrompt: subAgent.systemPrompt,
            newPrompt,
            reason,
          },
        });

        notificationBus.emitNotificationUpdate(agent.userId);

        return {
          success: true,
          subAgentName: subAgent.name,
          reason,
          message: `Prompt for "${subAgent.name}" updated. Previous saved in history.`,
        };
      } catch (err) {
        return { error: err instanceof Error ? err.message : String(err) };
      }
    },
  });

  return tools;
}
