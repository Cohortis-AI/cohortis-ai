import { NextResponse } from "next/server";
import { getEffectiveSession } from "@/lib/auth-utils";
import { getApprovalById, reviewApproval } from "@/lib/db/queries";
import { requireWorkspaceAccess } from "@/lib/workspace/auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ approvalId: string }> }
) {
  const session = await getEffectiveSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { approvalId } = await params;
  const approval = await getApprovalById(approvalId);
  if (!approval) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    await requireWorkspaceAccess(session.user.id, approval.workspaceId);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(approval);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ approvalId: string }> }
) {
  const session = await getEffectiveSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { approvalId } = await params;
  const approval = await getApprovalById(approvalId);
  if (!approval) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    await requireWorkspaceAccess(
      session.user.id,
      approval.workspaceId,
      "admin"
    );
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (approval.status !== "pending") {
    return NextResponse.json(
      { error: "Approval has already been reviewed" },
      { status: 409 }
    );
  }

  const body = await request.json();
  const { status, reviewNote } = body;

  if (!status || !["approved", "rejected"].includes(status)) {
    return NextResponse.json(
      { error: 'status must be "approved" or "rejected"' },
      { status: 400 }
    );
  }

  const updated = await reviewApproval(approvalId, {
    status,
    reviewedBy: session.user.id,
    reviewNote: reviewNote || undefined,
  });

  return NextResponse.json(updated);
}
