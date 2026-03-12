import { NextResponse } from "next/server";
import { getEffectiveSession } from "@/lib/auth-utils";
import {
  getBudgetsByWorkspace,
  createBudget,
  getAgentById,
  getBudgetByAgent,
} from "@/lib/db/queries";
import { requireWorkspaceAccess } from "@/lib/workspace/auth";

export async function GET(request: Request) {
  const session = await getEffectiveSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceId = request.headers.get("x-workspace-id");
  if (!workspaceId) {
    return NextResponse.json({ error: "No workspace" }, { status: 400 });
  }

  try {
    await requireWorkspaceAccess(session.user.id, workspaceId);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const budgets = await getBudgetsByWorkspace(workspaceId);
  // Flatten joined result for frontend consumption
  const flat = budgets.map((b) => ({
    ...b.budget,
    agentName: b.agentName,
  }));
  return NextResponse.json(flat);
}

export async function POST(request: Request) {
  const session = await getEffectiveSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceId = request.headers.get("x-workspace-id");
  if (!workspaceId) {
    return NextResponse.json({ error: "No workspace" }, { status: 400 });
  }

  try {
    await requireWorkspaceAccess(session.user.id, workspaceId, "admin");
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { agentId, monthlyLimitUsd, warningThreshold } = body;

  if (!agentId || typeof agentId !== "string") {
    return NextResponse.json(
      { error: "agentId is required" },
      { status: 400 }
    );
  }

  if (
    monthlyLimitUsd === undefined ||
    monthlyLimitUsd === null ||
    isNaN(parseFloat(monthlyLimitUsd))
  ) {
    return NextResponse.json(
      { error: "monthlyLimitUsd is required and must be a number" },
      { status: 400 }
    );
  }

  if (parseFloat(monthlyLimitUsd) <= 0) {
    return NextResponse.json(
      { error: "monthlyLimitUsd must be greater than 0" },
      { status: 400 }
    );
  }

  // Validate agent belongs to workspace
  const agent = await getAgentById(agentId);
  if (!agent || agent.workspaceId !== workspaceId) {
    return NextResponse.json(
      { error: "Agent not found in this workspace" },
      { status: 404 }
    );
  }

  // Check if budget already exists for this agent
  const existingBudget = await getBudgetByAgent(agentId);
  if (existingBudget) {
    return NextResponse.json(
      { error: "Budget already exists for this agent" },
      { status: 409 }
    );
  }

  const budget = await createBudget({
    workspaceId,
    agentId,
    monthlyLimitUsd: parseFloat(monthlyLimitUsd).toFixed(2),
    warningThreshold:
      warningThreshold !== undefined ? warningThreshold : undefined,
  });

  return NextResponse.json(budget, { status: 201 });
}
