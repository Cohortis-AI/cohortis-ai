/**
 * API client that automatically includes the x-workspace-id header
 * from the cohortis_workspace_id cookie.
 */

function getWorkspaceId(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    /(?:^|;\s*)cohortis_workspace_id=([^;]+)/
  );
  return match ? decodeURIComponent(match[1]) : null;
}

function buildHeaders(init?: RequestInit): HeadersInit {
  const headers = new Headers(init?.headers);
  const workspaceId = getWorkspaceId();
  if (workspaceId && !headers.has("x-workspace-id")) {
    headers.set("x-workspace-id", workspaceId);
  }
  if (
    init?.body &&
    typeof init.body === "string" &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }
  return headers;
}

export async function apiFetch(
  input: string | URL | Request,
  init?: RequestInit
): Promise<Response> {
  return fetch(input, {
    ...init,
    headers: buildHeaders(init),
  });
}

/**
 * SWR-compatible fetcher that includes workspace headers.
 */
export const fetcher = (url: string) =>
  apiFetch(url).then((r) => {
    if (!r.ok) throw new Error(`API error: ${r.status}`);
    return r.json();
  });
