import { getWorkspaceById } from "@/lib/db/queries";

export async function getWorkspaceContext(workspaceId: string) {
  const workspace = await getWorkspaceById(workspaceId);
  if (!workspace) throw new Error("Workspace not found");

  return {
    id: workspace.id,
    name: workspace.name,
    plan: workspace.plan,
    sharedMemory: workspace.sharedMemory || {
      mission: "",
      teamContext: "",
      orgContext: "",
    },
    settings: workspace.settings || {
      maxAgents: 5,
      maxDepth: 3,
      allowMemberExecution: true,
    },
  };
}
