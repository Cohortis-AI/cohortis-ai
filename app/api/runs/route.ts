import { NextResponse } from "next/server";
import { getEffectiveSession } from "@/lib/auth-utils";
import { getAgentRunsByWorkspace } from "@/lib/db/queries";
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

  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "30"), 200);
  const offset = parseInt(url.searchParams.get("offset") || "0");
  const format = url.searchParams.get("format");

  const runs = await getAgentRunsByWorkspace(workspaceId, { limit, offset });

  // CSV export
  if (format === "csv") {
    const headers = [
      "id",
      "agentId",
      "task",
      "status",
      "durationMs",
      "tokensUsed",
      "estimatedCostUsd",
      "createdAt",
      "completedAt",
    ];
    const csvRows = [
      headers.join(","),
      ...runs.map((r: any) =>
        headers
          .map((h) => {
            const val = r[h];
            if (val === null || val === undefined) return "";
            const str = String(val);
            return str.includes(",") || str.includes('"')
              ? `"${str.replace(/"/g, '""')}"`
              : str;
          })
          .join(",")
      ),
    ];
    return new Response(csvRows.join("\n"), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="cohortis-runs-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  }

  // JSON export
  if (format === "json") {
    return new Response(JSON.stringify(runs, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="cohortis-runs-${new Date().toISOString().split("T")[0]}.json"`,
      },
    });
  }

  return NextResponse.json(runs);
}
