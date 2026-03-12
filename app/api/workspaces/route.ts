import { NextResponse } from "next/server";
import { getEffectiveSession } from "@/lib/auth-utils";
import { getWorkspacesByUserId, createWorkspace } from "@/lib/db/queries";

export async function GET() {
  const session = await getEffectiveSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaces = await getWorkspacesByUserId(session.user.id);
  return NextResponse.json(workspaces);
}

export async function POST(request: Request) {
  const session = await getEffectiveSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { name } = body;

  if (!name || typeof name !== "string" || name.trim() === "") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const workspace = await createWorkspace({
    name: name.trim(),
    slug: `${slug}-${Date.now().toString(36)}`,
    ownerId: session.user.id,
  });

  return NextResponse.json(workspace, { status: 201 });
}
