import { tool } from "ai";
import { z } from "zod";
import { executeAgentTask } from "@/lib/agents/executor";
import {
  createAgentMessage,
  updateAgentPromptWithHistory,
} from "@/lib/db/queries";
import { notificationBus } from "@/lib/notifications/event-bus";
import type { agents } from "@/lib/db/schema";

type Agent = typeof agents.$inferSelect;

const MAX_ORCHESTRATOR_PROMPT_UPDATES = 5;
const MAX_BROADCAST_AGENTS = 10;
const orchestratorPromptCounts = new Map<
  string,
  { count: number; resetAt: number }
>();

function checkOrchestratorPromptLimit(workspaceId: string): boolean {
  const now = Date.now();
  const entry = orchestratorPromptCounts.get(workspaceId);
  if (!entry || now > entry.resetAt) {
    orchestratorPromptCounts.set(workspaceId, {
      count: 1,
      resetAt: now + 24 * 60 * 60 * 1000,
    });
    return true;
  }
  if (entry.count >= MAX_ORCHESTRATOR_PROMPT_UPDATES) return false;
  entry.count++;
  return true;
}

export function createDelegationTools(
  workspaceAgents: Agent[],
  workspaceId: string,
  initiatedBy?: string,
  userTimezone?: string
) {
  return {
    delegate_to_agent: tool({
      description:
        "Delegate a task to a specific agent by ID. The agent will execute using its own skills, knowledge, and tools, then return the result.",
      parameters: z.object({
        agentId: z.string().describe("The ID of the agent to delegate to"),
        task: z
          .string()
          .describe("The task description to send to the agent"),
      }),
      execute: async ({ agentId, task }) => {
        const agent = workspaceAgents.find((a) => a.id === agentId);
        if (!agent) {
          return { error: "Agent not found", agentId };
        }
        if (!agent.isActive) {
          return {
            error: `Agent "${agent.name}" is currently paused`,
            agentId,
            agentName: agent.name,
          };
        }

        // Log delegation message
        await createAgentMessage({
          workspaceId,
          senderAgentId: agentId,
          type: "delegation",
          content: task,
          metadata: {
            source: "team-chat-orchestrator",
            targetAgentName: agent.name,
          },
        }).catch(() => {});

        try {
          const result = await executeAgentTask({
            agent,
            task,
            workspaceId,
            userTimezone,
            initiatedBy,
          });

          // Log result as report
          await createAgentMessage({
            workspaceId,
            senderAgentId: agentId,
            type: "report",
            content:
              result.status === "completed"
                ? (result.result || "Task completed").slice(0, 2000)
                : (result.error || "Task failed").slice(0, 2000),
            metadata: {
              runId: result.runId,
              status: result.status,
              source: "team-chat-orchestrator",
            },
          }).catch(() => {});

          return {
            agentId: agent.id,
            agentName: agent.name,
            agentType: agent.type,
            status: result.status,
            response:
              result.status === "completed"
                ? "result" in result ? result.result : undefined
                : "error" in result ? result.error : undefined,
            durationMs: result.durationMs,
            tokensUsed: "tokensUsed" in result ? result.tokensUsed : undefined,
          };
        } catch (err) {
          return {
            agentId: agent.id,
            agentName: agent.name,
            status: "failed",
            error: err instanceof Error ? err.message : String(err),
          };
        }
      },
    }),

    broadcast_to_agents: tool({
      description:
        "Send the same instruction to ALL active agents simultaneously. Use for team-wide directives like changing tone, priorities, or general instructions.",
      parameters: z.object({
        task: z
          .string()
          .describe("The instruction to send to all agents"),
      }),
      execute: async ({ task }) => {
        const activeAgents = workspaceAgents.filter((a) => a.isActive);
        if (activeAgents.length === 0) {
          return { error: "No active agents available" };
        }

        if (activeAgents.length > MAX_BROADCAST_AGENTS) {
          return {
            error: `Too many active agents (${activeAgents.length}). Broadcast is limited to ${MAX_BROADCAST_AGENTS} agents to control costs. Use delegate_to_agent for targeted delegation.`,
          };
        }

        // Log broadcast messages
        for (const agent of activeAgents) {
          await createAgentMessage({
            workspaceId,
            senderAgentId: agent.id,
            type: "broadcast",
            content: task,
            metadata: {
              source: "team-chat-orchestrator",
              targetAgentName: agent.name,
            },
          }).catch(() => {});
        }

        const results = await Promise.allSettled(
          activeAgents.map((agent) =>
            executeAgentTask({
              agent,
              task,
              workspaceId,
              userTimezone,
              initiatedBy,
            })
              .then((r) => ({
                agentId: agent.id,
                agentName: agent.name,
                agentType: agent.type,
                status: r.status,
                response:
                  r.status === "completed" ? r.result : r.error,
                durationMs: r.durationMs,
              }))
              .catch((err) => ({
                agentId: agent.id,
                agentName: agent.name,
                agentType: agent.type,
                status: "failed" as const,
                response:
                  err instanceof Error ? err.message : String(err),
              }))
          )
        );

        return {
          totalAgents: activeAgents.length,
          results: results.map((r) =>
            r.status === "fulfilled" ? r.value : { error: "Execution failed" }
          ),
        };
      },
    }),

    list_available_agents: tool({
      description:
        "List all available agents with their capabilities and hierarchy. Use this to understand the team before delegating.",
      parameters: z.object({}),
      execute: async () => ({
        agents: workspaceAgents.map((a) => ({
          id: a.id,
          name: a.name,
          type: a.type,
          description: a.description,
          skills: a.capabilities,
          role: a.role,
          parentAgentId: a.parentAgentId,
          isActive: a.isActive,
          model: a.model,
        })),
      }),
    }),

    update_agent_prompt: tool({
      description:
        "Modify the system prompt of an agent to improve its performance. " +
        "Use this when an agent produced unsatisfactory results and you can identify specific improvements. " +
        "The previous prompt is saved in history for rollback. The user is notified of all prompt changes.",
      parameters: z.object({
        agentId: z
          .string()
          .describe("The ID of the agent whose prompt to modify"),
        newPrompt: z
          .string()
          .describe("The complete new system prompt for the agent"),
        reason: z
          .string()
          .describe(
            "Why you are modifying this prompt (what was wrong, what should improve)"
          ),
      }),
      execute: async ({ agentId, newPrompt, reason }) => {
        const agent = workspaceAgents.find((a) => a.id === agentId);
        if (!agent) {
          return { error: "Agent not found", agentId };
        }

        if (newPrompt.trim().length < 20) {
          return {
            error:
              "New prompt is too short. Provide meaningful instructions (at least 20 characters).",
          };
        }

        if (!checkOrchestratorPromptLimit(workspaceId)) {
          return {
            error: `Daily prompt update limit reached (${MAX_ORCHESTRATOR_PROMPT_UPDATES}/day). Try again tomorrow.`,
          };
        }

        try {
          await updateAgentPromptWithHistory(
            agentId,
            newPrompt,
            "orchestrator",
            reason
          );

          // Log the prompt update
          await createAgentMessage({
            workspaceId,
            senderAgentId: agentId,
            type: "prompt_update",
            content: `Prompt updated by Team Orchestrator. Reason: ${reason}`,
            metadata: {
              previousPrompt: agent.systemPrompt,
              newPrompt,
              reason,
              source: "team-chat-orchestrator",
            },
          }).catch(() => {});

          notificationBus.emitNotificationUpdate(agent.userId);

          return {
            success: true,
            agentId: agent.id,
            agentName: agent.name,
            reason,
            previousPromptLength: (agent.systemPrompt || "").length,
            newPromptLength: newPrompt.length,
            message: `Prompt for "${agent.name}" has been updated. Previous prompt saved in history.`,
          };
        } catch (err) {
          return {
            error: err instanceof Error ? err.message : String(err),
          };
        }
      },
    }),
  };
}
