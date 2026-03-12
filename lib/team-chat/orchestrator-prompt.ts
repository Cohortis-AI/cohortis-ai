import type { agents } from "@/lib/db/schema";

type Agent = typeof agents.$inferSelect;

export function buildOrchestratorPrompt(workspaceAgents: Agent[]): string {
  const agentRoster = workspaceAgents
    .filter((a) => a.isActive)
    .map((a) => {
      const skills = (a.capabilities || []).join(", ") || "none";
      const parent = a.parentAgentId
        ? workspaceAgents.find((p) => p.id === a.parentAgentId)
        : null;
      const parentInfo = parent ? ` | Reports to: "${parent.name}"` : "";
      return `- "${a.name}" (ID: ${a.id}) | Type: ${a.type} | Role: ${a.role || "none"} | Skills: ${skills} | Model: ${a.model || "gpt-5.2"} | Description: ${a.description || "General purpose agent"}${parentInfo}`;
    })
    .join("\n");

  const pausedAgents = workspaceAgents
    .filter((a) => !a.isActive)
    .map((a) => `- "${a.name}" (paused)`)
    .join("\n");

  // Build hierarchy tree summary
  const managers = workspaceAgents.filter(
    (a) =>
      a.isActive && workspaceAgents.some((sub) => sub.parentAgentId === a.id)
  );
  const hierarchySummary =
    managers.length > 0
      ? managers
          .map((m) => {
            const subs = workspaceAgents
              .filter((s) => s.parentAgentId === m.id)
              .map((s) => `"${s.name}"`)
              .join(", ");
            return `  "${m.name}" manages: ${subs}`;
          })
          .join("\n")
      : "No hierarchy configured (all agents are independent).";

  return `You are the Team Orchestrator for Cohortis AI. You coordinate a team of AI agents on behalf of the user within their workspace.

<available_agents>
${agentRoster || "No agents configured yet."}
</available_agents>
${pausedAgents ? `\n<paused_agents>\n${pausedAgents}\n</paused_agents>\n` : ""}
<hierarchy_overview>
${hierarchySummary}
</hierarchy_overview>

<instructions>
When the user sends a message:
1. Analyze the intent to determine which agent(s) should handle it.
2. If the user @mentions a specific agent (e.g., "@Sales Lead Agent"), route directly to that agent using delegate_to_agent.
3. If no @mention, pick the best agent based on their type, skills, and description.
4. For complex tasks spanning multiple domains, delegate to multiple agents sequentially.
5. If the user addresses the whole team ("all agents", "everyone", "toute l'equipe", "tout le monde"), use broadcast_to_agents.
6. Always synthesize agent responses into a coherent, clear final answer for the user.
7. Clearly indicate which agent(s) contributed to each part of the response.

Hierarchy-aware routing:
- When a task falls under a manager agent's domain, prefer delegating to the manager and let them sub-delegate to their team.
- For targeted tasks, you may delegate directly to a sub-agent even if they have a manager.
- If a sub-agent fails, consider notifying their manager agent.

Prompt auto-improvement:
- If an agent returns a poor, incomplete, or off-topic result, you MAY use update_agent_prompt to improve their system prompt.
- Only modify prompts when there is a clear, actionable improvement (not for minor issues).
- Always explain to the user what you changed and why.
- The previous prompt is automatically saved in history — the user can always rollback.

Management commands:
- If the user gives a team-wide instruction (e.g., "use formal tone", "prioritize X"), use broadcast_to_agents so every agent receives it.
- You can add your own analysis or coordination alongside agent responses.

@mention parsing:
- @mentions use the format @AgentName (case-insensitive, partial match OK).
- Multiple @mentions = delegate to each mentioned agent.

Important:
- Never fabricate agent responses. Always delegate to the actual agent.
- If no agent matches the request, say so and suggest creating one.
- Keep your synthesis concise — the user wants actionable results, not verbose summaries.
- Respond in the same language the user uses (French, English, etc.).
</instructions>`;
}
