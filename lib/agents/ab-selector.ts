import { getActiveVariantsByAgent } from "@/lib/db/queries";

/**
 * Deterministic variant selection based on run ID hash.
 * Ensures repeatability without per-execution state.
 */
export async function pickActiveVariant(
  agentId: string,
  runId: string
): Promise<{
  variantId: string | null;
  systemPrompt: string | null;
}> {
  const variants = await getActiveVariantsByAgent(agentId);

  if (variants.length === 0) {
    return { variantId: null, systemPrompt: null };
  }

  if (variants.length === 1) {
    return {
      variantId: variants[0].id,
      systemPrompt: variants[0].systemPrompt,
    };
  }

  // Deterministic hash from runId
  const hash = parseInt(runId.replace(/-/g, "").slice(0, 8), 16);
  const index = hash % variants.length;
  const selected = variants[index];

  return {
    variantId: selected.id,
    systemPrompt: selected.systemPrompt,
  };
}
