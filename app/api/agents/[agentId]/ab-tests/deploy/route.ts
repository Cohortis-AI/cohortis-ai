import { NextResponse } from "next/server";
import { getEffectiveSession } from "@/lib/auth-utils";
import { requireWorkspaceAccess } from "@/lib/workspace/auth";
import { getAgentById } from "@/lib/db/queries";
import { deployVariant } from "@/lib/agents/ab-deploy";
import { db } from "@/lib/db/index";
import { promptVariants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const session = await getEffectiveSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { agentId } = await params;

  const agent = await getAgentById(agentId);
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  try {
    await requireWorkspaceAccess(session.user.id, agent.workspaceId, "admin");
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { variantId } = body;

  if (!variantId) {
    return NextResponse.json(
      { error: "variantId required" },
      { status: 400 }
    );
  }

  // Get the variant
  const [variant] = await db
    .select()
    .from(promptVariants)
    .where(eq(promptVariants.id, variantId));

  if (!variant || variant.agentId !== agentId) {
    return NextResponse.json(
      { error: "Variant not found" },
      { status: 404 }
    );
  }

  await deployVariant(agentId, variantId, variant.systemPrompt);

  return NextResponse.json({
    deployed: true,
    variantId,
    variantName: variant.name,
  });
}
