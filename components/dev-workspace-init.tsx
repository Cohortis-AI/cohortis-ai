"use client";

import { useEffect } from "react";

const DEV_WORKSPACE_ID = "00000000-0000-0000-0000-000000000010";

/**
 * In dev mode, ensures the workspace cookie is set so client-side
 * fetch calls can include the x-workspace-id header.
 */
export function DevWorkspaceInit() {
  useEffect(() => {
    if (typeof document === "undefined") return;
    const existing = document.cookie.match(
      /(?:^|;\s*)cohortis_workspace_id=([^;]+)/
    );
    if (!existing) {
      document.cookie = `cohortis_workspace_id=${DEV_WORKSPACE_ID};path=/;max-age=31536000`;
    }
  }, []);

  return null;
}
