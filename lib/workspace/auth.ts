import { getWorkspaceMember } from "@/lib/db/queries";

const ROLE_HIERARCHY = ["viewer", "member", "admin", "owner"] as const;
type WorkspaceRole = (typeof ROLE_HIERARCHY)[number];

export async function requireWorkspaceAccess(
  userId: string,
  workspaceId: string,
  minRole: WorkspaceRole = "member"
): Promise<{ userId: string; workspaceId: string; role: WorkspaceRole }> {
  const member = await getWorkspaceMember(workspaceId, userId);

  if (!member) {
    throw new Error("Not a member of this workspace");
  }

  const memberRoleIndex = ROLE_HIERARCHY.indexOf(member.role as WorkspaceRole);
  const minRoleIndex = ROLE_HIERARCHY.indexOf(minRole);

  if (memberRoleIndex < minRoleIndex) {
    throw new Error(`Requires at least ${minRole} role`);
  }

  return {
    userId,
    workspaceId,
    role: member.role as WorkspaceRole,
  };
}
