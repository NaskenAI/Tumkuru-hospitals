import { NextResponse, type NextRequest } from "next/server";

import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_MS,
  verifySessionToken,
} from "@/lib/auth/session";

// Paths under the protected prefixes that must stay reachable without a session.
// - /admin/login: the login screen itself
// - /api/auth/*: login/logout endpoints
// - /api/analytics: public preview analytics ingest (no admin data)
const PUBLIC_EXACT = new Set(["/admin/login", "/api/analytics"]);
const PUBLIC_PREFIXES = ["/api/auth/", "/api/analytics/"];

/**
 * Whether a matched path is reachable without an admin session. Everything else
 * under /admin/* and /api/* requires a valid session cookie. Exported for tests.
 * Matches are exact or true sub-paths so a lookalike like /api/analyticsX is
 * NOT treated as public.
 */
export function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const secret = process.env.ADMIN_SESSION_SECRET;
  const token = request.cookies.get(SESSION_COOKIE)?.value;

  const authenticated = Boolean(
    secret &&
      token &&
      (await verifySessionToken(token, secret, SESSION_MAX_AGE_MS)),
  );

  if (authenticated) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { ok: false, message: "Unauthorized. Sign in to the admin console." },
      { status: 401 },
    );
  }

  const loginUrl = new URL("/admin/login", request.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/admin/:path*", "/api/:path*"],
};
