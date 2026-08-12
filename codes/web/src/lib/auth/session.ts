/**
 * Admin session tokens.
 *
 * A session is a short HMAC-SHA256 signed token of the form
 * `base64url(payload).base64url(signature)` where payload = { iat }.
 *
 * Implemented with the Web Crypto API (globalThis.crypto.subtle) so the same
 * code runs in both the Edge middleware and Node route handlers. HMAC verify is
 * constant-time inside subtle.verify.
 */

export const SESSION_COOKIE = "nasken_admin_session";
export const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 12; // 12 hours

const encoder = new TextEncoder();

// TS 5.7+ types typed arrays as Uint8Array<ArrayBufferLike>, which does not
// structurally satisfy the Web Crypto `BufferSource` parameter. Narrow at the
// call boundary.
function asBufferSource(data: Uint8Array): BufferSource {
  return data as BufferSource;
}

function utf8(value: string): BufferSource {
  return asBufferSource(encoder.encode(value));
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(input: string): Uint8Array {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    utf8(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function createSessionToken(
  secret: string,
  now: number = Date.now(),
): Promise<string> {
  const payload = base64UrlEncode(
    encoder.encode(JSON.stringify({ iat: now })),
  );
  const key = await importHmacKey(secret);
  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, utf8(payload)),
  );
  return `${payload}.${base64UrlEncode(signature)}`;
}

export async function verifySessionToken(
  token: string,
  secret: string,
  maxAgeMs: number = SESSION_MAX_AGE_MS,
  now: number = Date.now(),
): Promise<boolean> {
  const parts = token.split(".");
  if (parts.length !== 2) return false;

  const [payload, signature] = parts;

  let signatureBytes: Uint8Array;
  try {
    signatureBytes = base64UrlDecode(signature);
  } catch {
    return false;
  }

  const key = await importHmacKey(secret);
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    asBufferSource(signatureBytes),
    utf8(payload),
  );
  if (!valid) return false;

  try {
    const decoded = JSON.parse(
      new TextDecoder().decode(base64UrlDecode(payload)),
    ) as { iat?: unknown };
    if (typeof decoded.iat !== "number") return false;
    if (now - decoded.iat > maxAgeMs) return false; // expired
    if (decoded.iat > now + 60_000) return false; // future-dated / clock skew guard
    return true;
  } catch {
    return false;
  }
}
