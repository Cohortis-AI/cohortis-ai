import { NextResponse } from "next/server";
import { getEffectiveSession } from "@/lib/auth-utils";
import { getBudgetById, updateBudget, deleteBudget } from "@/lib/db/queries";
import { requireWorkspaceAccess } from "@/lib/workspace/auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ budgetId: string }> }
) {
  const session = await getEffectiveSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { budgetId } = await params;
  const budget = await getBudgetById(budgetId);
  if (!budget) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    await requireWorkspaceAccess(session.user.id, budget.workspaceId);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(budget);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ budgetId: string }> }
) {
  const session = await getEffectiveSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { budgetId } = await params;
  const budget = await getBudgetById(budgetId);
  if (!budget) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    await requireWorkspaceAccess(session.user.id, budget.workspaceId, "admin");
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const updateData: Record<string, unknown> = {};

  if (body.monthlyLimitUsd !== undefined) {
    const limit = parseFloat(body.monthlyLimitUsd);
    if (isNaN(limit) || limit <= 0) {
      return NextResponse.json(
        { error: "monthlyLimitUsd must be a positive number" },
        { status: 400 }
      );
    }
    updateData.monthlyLimitUsd = limit.toFixed(2);
  }

  if (body.warningThreshold !== undefined) {
    const threshold = parseInt(body.warningThreshold);
    if (isNaN(threshold) || threshold < 0 || threshold > 100) {
      return NextResponse.json(
        { error: "warningThreshold must be between 0 and 100" },
        { status: 400 }
      );
    }
    updateData.warningThreshold = threshold;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update" },
      { status: 400 }
    );
  }

  const updated = await updateBudget(budgetId, updateData as any);
  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ budgetId: string }> }
) {
  const session = await getEffectiveSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { budgetId } = await params;
  const budget = await getBudgetById(budgetId);
  if (!budget) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    await requireWorkspaceAccess(session.user.id, budget.workspaceId, "admin");
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await deleteBudget(budgetId);
  return NextResponse.json({ deleted: true });
}
