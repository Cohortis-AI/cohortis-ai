export interface ParsedMention {
  agentId: string;
  agentName: string;
  matchedText: string;
}

export interface MentionParseResult {
  mentions: ParsedMention[];
  cleanText: string;
}

/**
 * Parse @AgentName mentions from user input.
 * Returns matched agents and cleaned text with structured references.
 */
export function parseMentions(
  text: string,
  agents: { id: string; name: string }[]
): MentionParseResult {
  const mentions: ParsedMention[] = [];
  let cleanText = text;

  // Sort agents by name length (longest first) to avoid partial matches
  const sortedAgents = [...agents].sort(
    (a, b) => b.name.length - a.name.length
  );

  for (const agent of sortedAgents) {
    // Match @AgentName (case-insensitive), handling multi-word names
    const escapedName = agent.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`@${escapedName}(?=\\s|$)`, "gi");
    const match = regex.exec(cleanText);
    if (match) {
      mentions.push({
        agentId: agent.id,
        agentName: agent.name,
        matchedText: match[0],
      });
      cleanText = cleanText.replace(
        match[0],
        `@[${agent.name}](agent:${agent.id})`
      );
    }
  }

  return { mentions, cleanText };
}

/**
 * Extract agent IDs from structured @[Name](agent:id) references in text.
 */
export function extractMentionedAgentIds(text: string): string[] {
  const regex = /@\[.*?\]\(agent:([a-f0-9-]+)\)/g;
  const ids: string[] = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    ids.push(match[1]);
  }
  return ids;
}
