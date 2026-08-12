"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";

export function LogoutButton() {
  const [isLoading, setIsLoading] = useState(false);

  async function logout() {
    setIsLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      // Full navigation so the cleared cookie is reflected on the next request
      // (avoids a stale prefetched RSC being served after sign-out).
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/admin/login";
    }
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={isLoading}
      className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
    >
      <LogOut size={14} aria-hidden="true" />
      {isLoading ? "Signing out" : "Sign out"}
    </button>
  );
}
