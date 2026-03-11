import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import {
  getWorkspaceById,
  updateWorkspace,
  deleteWorkspace,
} from "@/lib/db/queries";
import { requireWorkspaceAccess } from "@/lib/workspace/auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workspaceId } = await params;

  try {
    await requireWorkspaceAccess(session.user.id, workspaceId, "viewer");
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const workspace = await getWorkspaceById(workspaceId);
  if (!workspace) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(workspace);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workspaceId } = await params;

  try {
    await requireWorkspaceAccess(session.user.id, workspaceId, "admin");
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const workspace = await updateWorkspace(workspaceId, body);
  return NextResponse.json(workspace);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workspaceId } = await params;

  try {
    await requireWorkspaceAccess(session.user.id, workspaceId, "owner");
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await deleteWorkspace(workspaceId);
  return NextResponse.json({ deleted: true });
}
