import {
  getActiveVariantsByAgent,
  updatePromptVariant,
  updateAgent,
  updateAgentPromptWithHistory,
} from "@/lib/db/queries";

const MIN_RUNS_FOR_DECISION = 10;
const WIN_THRESHOLD = 0.15; // 15% improvement to auto-deploy

/**
 * Check if any variant has a clear winner and auto-deploy if so.
 * Called after every A/B test run update.
 */
export async function checkAndAutoDeploy(agentId: string): Promise<{
  deployed: boolean;
  winnerId?: string;
  winnerName?: string;
  reason?: string;
}> {
  const variants = await getActiveVariantsByAgent(agentId);
  if (variants.length < 2) {
    return { deployed: false, reason: "Need at least 2 active variants" };
  }

  // Only consider variants with enough runs
  const eligible = variants.filter(
    (v) => (v.totalRuns || 0) >= MIN_RUNS_FOR_DECISION
  );
  if (eligible.length < 2) {
    return {
      deployed: false,
      reason: `Not enough data yet (need ${MIN_RUNS_FOR_DECISION} runs per variant)`,
    };
  }

  // Find control variant
  const control = eligible.find((v) => v.isControl);
  if (!control) {
    return { deployed: false, reason: "No control variant found" };
  }

  const controlScore = parseFloat(control.score || "0");

  // Find best challenger
  const challengers = eligible.filter((v) => !v.isControl);
  if (challengers.length === 0) {
    return { deployed: false, reason: "No challenger variants" };
  }

  let bestChallenger = challengers[0];
  let bestScore = parseFloat(bestChallenger.score || "0");

  for (const c of challengers) {
    const score = parseFloat(c.score || "0");
    if (score > bestScore) {
      bestChallenger = c;
      bestScore = score;
    }
  }

  // Check if winner beats control by threshold
  const improvement =
    controlScore > 0
      ? (bestScore - controlScore) / controlScore
      : bestScore > 0
        ? 1
        : 0;

  if (improvement < WIN_THRESHOLD) {
    return {
      deployed: false,
      reason: `Best challenger score ${bestScore.toFixed(1)} vs control ${controlScore.toFixed(1)} — not enough improvement (${(improvement * 100).toFixed(0)}% < ${WIN_THRESHOLD * 100}% threshold)`,
    };
  }

  // Deploy the winner
  await deployVariant(agentId, bestChallenger.id, bestChallenger.systemPrompt);

  return {
    deployed: true,
    winnerId: bestChallenger.id,
    winnerName: bestChallenger.name,
    reason: `Variant "${bestChallenger.name}" outperformed control by ${(improvement * 100).toFixed(0)}% (score ${bestScore.toFixed(1)} vs ${controlScore.toFixed(1)})`,
  };
}

/**
 * Manually deploy a specific variant to the agent's system prompt.
 */
export async function deployVariant(
  agentId: string,
  variantId: string,
  systemPrompt: string
) {
  // Update the agent's system prompt with history
  await updateAgentPromptWithHistory(
    agentId,
    systemPrompt,
    "ab-auto-deploy",
    `A/B test winner deployed (variant: ${variantId})`
  );

  // Mark variant as deployed
  await updatePromptVariant(variantId, {
    deployedAt: new Date(),
  });

  // Set this as the active variant
  await updateAgent(agentId, {
    activeVariantId: variantId,
  });
}
