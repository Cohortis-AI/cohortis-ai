import { NextResponse } from "next/server";
import { getEffectiveSession } from "@/lib/auth-utils";
import {
  getHeartbeatById,
  updateHeartbeat,
  deleteHeartbeat,
} from "@/lib/db/queries";
import { requireWorkspaceAccess } from "@/lib/workspace/auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ heartbeatId: string }> }
) {
  const session = await getEffectiveSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { heartbeatId } = await params;
  const heartbeat = await getHeartbeatById(heartbeatId);
  if (!heartbeat) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    await requireWorkspaceAccess(session.user.id, heartbeat.workspaceId);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(heartbeat);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ heartbeatId: string }> }
) {
  const session = await getEffectiveSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { heartbeatId } = await params;
  const heartbeat = await getHeartbeatById(heartbeatId);
  if (!heartbeat) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    await requireWorkspaceAccess(session.user.id, heartbeat.workspaceId);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();

  const validFrequencies = ["5m", "15m", "30m", "1h", "4h", "12h", "24h"];
  if (body.frequency && !validFrequencies.includes(body.frequency)) {
    return NextResponse.json(
      { error: "Invalid frequency" },
      { status: 400 }
    );
  }

  const updated = await updateHeartbeat(heartbeatId, body);
  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ heartbeatId: string }> }
) {
  const session = await getEffectiveSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { heartbeatId } = await params;
  const heartbeat = await getHeartbeatById(heartbeatId);
  if (!heartbeat) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    await requireWorkspaceAccess(session.user.id, heartbeat.workspaceId, "admin");
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await deleteHeartbeat(heartbeatId);
  return NextResponse.json({ deleted: true });
}
