import { NextResponse } from "next/server";
import { getEffectiveSession } from "@/lib/auth-utils";
import { getWorkspacesByUserId } from "@/lib/db/queries";

export async function GET() {
  const session = await getEffectiveSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const memberships = await getWorkspacesByUserId(session.user.id);
  return NextResponse.json(memberships);
}
