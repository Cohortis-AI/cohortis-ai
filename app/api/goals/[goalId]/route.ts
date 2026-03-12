import { NextResponse } from "next/server";
import { getEffectiveSession } from "@/lib/auth-utils";
import { getGoalById, updateGoal, deleteGoal } from "@/lib/db/queries";
import { requireWorkspaceAccess } from "@/lib/workspace/auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ goalId: string }> }
) {
  const session = await getEffectiveSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { goalId } = await params;
  const goal = await getGoalById(goalId);
  if (!goal) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    await requireWorkspaceAccess(session.user.id, goal.workspaceId);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(goal);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ goalId: string }> }
) {
  const session = await getEffectiveSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { goalId } = await params;
  const goal = await getGoalById(goalId);
  if (!goal) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    await requireWorkspaceAccess(session.user.id, goal.workspaceId);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();

  // Parse dueAt if provided as string
  if (body.dueAt && typeof body.dueAt === "string") {
    body.dueAt = new Date(body.dueAt);
  }
  if (body.completedAt && typeof body.completedAt === "string") {
    body.completedAt = new Date(body.completedAt);
  }

  // Auto-set completedAt when status changes to completed
  if (body.status === "completed" && !body.completedAt) {
    body.completedAt = new Date();
  }

  const updated = await updateGoal(goalId, body);
  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ goalId: string }> }
) {
  const session = await getEffectiveSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { goalId } = await params;
  const goal = await getGoalById(goalId);
  if (!goal) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    await requireWorkspaceAccess(session.user.id, goal.workspaceId, "admin");
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await deleteGoal(goalId);
  return NextResponse.json({ deleted: true });
}
