import { describe, expect, it } from "vitest";

import { isPublicPath } from "@/proxy";

// The proxy denies any matched /admin/* or /api/* path that is not public,
// returning 401 for API and redirecting admin pages to /admin/login unless the
// request carries a session cookie that passes verifySessionToken.
describe("authorization surface (P0-1)", () => {
  it("keeps internal API endpoints protected", () => {
    const protectedApi = [
      "/api/leads/import",
      "/api/leads/abc/sources/collect",
      "/api/leads/abc/extract",
      "/api/leads/abc/generate",
      "/api/leads/abc/translate",
      "/api/leads/abc/content/approve",
      "/api/leads/abc/deploy",
      "/api/leads/abc/outreach",
      "/api/facts/xyz/review",
    ];
    for (const path of protectedApi) {
      expect(isPublicPath(path)).toBe(false);
    }
  });

  it("keeps admin pages protected", () => {
    expect(isPublicPath("/admin")).toBe(false);
    expect(isPublicPath("/admin/leads")).toBe(false);
    expect(isPublicPath("/admin/leads/abc/facts")).toBe(false);
  });

  it("allows only the intended public paths", () => {
    expect(isPublicPath("/admin/login")).toBe(true);
    expect(isPublicPath("/api/auth/login")).toBe(true);
    expect(isPublicPath("/api/auth/logout")).toBe(true);
    expect(isPublicPath("/api/analytics")).toBe(true);
  });

  it("does not treat lookalike paths as public", () => {
    expect(isPublicPath("/admin/login-not-really")).toBe(false);
    expect(isPublicPath("/api/authx/thing")).toBe(false);
    expect(isPublicPath("/api/analyticsX")).toBe(false);
    expect(isPublicPath("/api/analytics-fake")).toBe(false);
  });
});
