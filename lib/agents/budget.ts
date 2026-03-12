import { getBudgetByAgent, addSpendToBudget } from "@/lib/db/queries";

export async function checkBudget(agentId: string): Promise<{
  allowed: boolean;
  budget: { limit: number; spent: number; percentage: number } | null;
  reason?: string;
}> {
  const budget = await getBudgetByAgent(agentId);
  if (!budget) return { allowed: true, budget: null }; // No budget = unlimited

  const limit = parseFloat(budget.monthlyLimitUsd);
  const spent = parseFloat(budget.currentSpendUsd);
  const percentage = limit > 0 ? Math.round((spent / limit) * 100) : 0;

  // Check if period expired — if so, it's allowed (period reset happens separately)
  if (new Date() > new Date(budget.periodEnd)) {
    return { allowed: true, budget: { limit, spent: 0, percentage: 0 } };
  }

  if (budget.isThrottled || spent >= limit) {
    return {
      allowed: false,
      budget: { limit, spent, percentage },
      reason: `Agent budget exhausted: $${spent.toFixed(2)} / $${limit.toFixed(2)} (${percentage}%)`,
    };
  }

  return { allowed: true, budget: { limit, spent, percentage } };
}

export async function recordSpend(
  agentId: string,
  costUsd: number
): Promise<void> {
  if (costUsd <= 0) return;
  await addSpendToBudget(agentId, costUsd.toFixed(6));
}
