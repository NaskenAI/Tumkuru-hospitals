"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Lock } from "lucide-react";

function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/admin";

  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const result = (await response.json()) as {
        ok: boolean;
        message?: string;
      };

      if (result.ok) {
        // Full navigation so the new cookie is sent on the next request and no
        // stale (unauthenticated) prefetched RSC is served.
        const target = next.startsWith("/admin") ? next : "/admin";
        window.location.assign(target);
      } else {
        setError(result.message ?? "Sign in failed.");
      }
    } catch {
      setError("Network error. Try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
    >
      <div className="flex size-10 items-center justify-center rounded-md bg-teal-50 text-teal-700">
        <Lock size={20} aria-hidden="true" />
      </div>
      <h1 className="mt-4 text-xl font-semibold text-slate-950">
        Admin sign in
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Nasken AI · Tumakuru preview pipeline
      </p>

      <label
        htmlFor="password"
        className="mt-6 block text-sm font-medium text-slate-700"
      >
        Password
      </label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-950 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
        required
      />

      {error && (
        <p className="mt-3 text-sm text-rose-700" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isLoading || password.length === 0}
        className="mt-5 inline-flex h-10 w-full items-center justify-center rounded-md bg-teal-700 px-4 text-sm font-medium text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {isLoading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

export default function AdminLoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
