import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";

import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_MS,
  createSessionToken,
} from "@/lib/auth/session";

export const runtime = "nodejs";

function safeEqual(a: string, b: string): boolean {
  const aBytes = Buffer.from(a, "utf-8");
  const bBytes = Buffer.from(b, "utf-8");
  if (aBytes.length !== bBytes.length) {
    // Still burn a comparison against a same-length buffer to avoid leaking
    // length via early return timing on the common path.
    timingSafeEqual(aBytes, aBytes);
    return false;
  }
  return timingSafeEqual(aBytes, bBytes);
}

export async function POST(request: NextRequest) {
  const password = process.env.ADMIN_PASSWORD;
  const secret = process.env.ADMIN_SESSION_SECRET;

  if (!password || !secret) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Admin auth is not configured. Set ADMIN_PASSWORD and ADMIN_SESSION_SECRET in .env.local.",
      },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    password?: unknown;
  } | null;
  const provided = typeof body?.password === "string" ? body.password : "";

  if (!provided || !safeEqual(provided, password)) {
    return NextResponse.json(
      { ok: false, message: "Invalid password." },
      { status: 401 },
    );
  }

  const token = await createSessionToken(secret);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(SESSION_MAX_AGE_MS / 1000),
  });
  return response;
}
