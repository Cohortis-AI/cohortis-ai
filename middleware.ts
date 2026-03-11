import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip auth check in dev mode
  if (process.env.DISABLE_AUTH === "true") {
    const response = NextResponse.next();
    // Set workspace from cookie
    const workspaceId = request.cookies.get("cohortis_workspace_id")?.value;
    if (workspaceId) {
      response.headers.set("x-workspace-id", workspaceId);
    }
    return response;
  }

  // Auth routes are always accessible
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  // Check for session token
  const token =
    request.cookies.get("authjs.session-token")?.value ||
    request.cookies.get("__Secure-authjs.session-token")?.value;

  if (!token && !pathname.startsWith("/api")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const response = NextResponse.next();

  // Forward workspace ID from cookie to header
  const workspaceId = request.cookies.get("cohortis_workspace_id")?.value;
  if (workspaceId) {
    response.headers.set("x-workspace-id", workspaceId);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
