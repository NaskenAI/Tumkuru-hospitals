import { describe, expect, it } from "vitest";

import {
  SESSION_MAX_AGE_MS,
  createSessionToken,
  verifySessionToken,
} from "@/lib/auth/session";

const secret = "test-secret-value-do-not-use-in-prod";

describe("session tokens", () => {
  it("verifies a freshly issued token", async () => {
    const now = 1_000_000;
    const token = await createSessionToken(secret, now);
    expect(await verifySessionToken(token, secret, SESSION_MAX_AGE_MS, now)).toBe(
      true,
    );
  });

  it("rejects a token signed with a different secret", async () => {
    const now = 1_000_000;
    const token = await createSessionToken(secret, now);
    expect(
      await verifySessionToken(token, "other-secret", SESSION_MAX_AGE_MS, now),
    ).toBe(false);
  });

  it("rejects a tampered payload (keeps signature, changes iat)", async () => {
    const now = 1_000_000;
    const token = await createSessionToken(secret, now);
    const [, sig] = token.split(".");
    // Re-encode a DIFFERENT payload but keep the original signature.
    const forgedPayload = btoa(JSON.stringify({ iat: now + 999 }))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const forged = `${forgedPayload}.${sig}`;
    expect(
      await verifySessionToken(forged, secret, SESSION_MAX_AGE_MS, now),
    ).toBe(false);
  });

  it("rejects an expired token", async () => {
    const iat = 1_000_000;
    const token = await createSessionToken(secret, iat);
    const later = iat + SESSION_MAX_AGE_MS + 1;
    expect(
      await verifySessionToken(token, secret, SESSION_MAX_AGE_MS, later),
    ).toBe(false);
  });

  it("rejects a future-dated token", async () => {
    const iat = 5_000_000;
    const token = await createSessionToken(secret, iat);
    const earlier = iat - 120_000;
    expect(
      await verifySessionToken(token, secret, SESSION_MAX_AGE_MS, earlier),
    ).toBe(false);
  });

  it("rejects malformed tokens", async () => {
    expect(await verifySessionToken("garbage", secret)).toBe(false);
    expect(await verifySessionToken("a.b.c", secret)).toBe(false);
    expect(await verifySessionToken("", secret)).toBe(false);
  });
});
