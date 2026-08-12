import { lookup } from "node:dns/promises";

export type ResolvedAddress = {
  address: string;
  family: 4 | 6;
};

export type ResolveHostname = (hostname: string) => Promise<ResolvedAddress[]>;

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

const allowedProtocols = new Set(["http:", "https:"]);

export function parseSafeHttpUrl(input: string | URL) {
  const url = input instanceof URL ? input : new URL(input);

  if (!allowedProtocols.has(url.protocol)) {
    throw new UnsafeUrlError("Only http and https URLs are allowed.");
  }

  if (isLocalhostName(url.hostname)) {
    throw new UnsafeUrlError("Localhost URLs are not allowed.");
  }

  // Restrict to standard web ports to shrink the SSRF surface (no odd internal
  // service ports). Empty port means the protocol default (80/443).
  if (url.port !== "" && url.port !== "80" && url.port !== "443") {
    throw new UnsafeUrlError(`Port ${url.port} is not allowed.`);
  }

  url.username = "";
  url.password = "";
  url.hash = "";

  return url;
}

export async function defaultResolveHostname(hostname: string) {
  return lookup(hostname, {
    all: true,
    verbatim: true,
  }) as Promise<ResolvedAddress[]>;
}

export async function assertPublicHostname(
  hostname: string,
  resolveHostname: ResolveHostname = defaultResolveHostname,
) {
  const addresses = await resolveHostname(hostname);

  if (addresses.length === 0) {
    throw new UnsafeUrlError("Hostname did not resolve.");
  }

  const unsafeAddress = addresses.find(({ address }) =>
    isPrivateOrReservedAddress(address),
  );

  if (unsafeAddress) {
    throw new UnsafeUrlError(
      `Hostname resolves to a private or reserved address: ${unsafeAddress.address}`,
    );
  }

  return addresses;
}

export async function assertSafeHttpUrl(
  input: string | URL,
  resolveHostname: ResolveHostname = defaultResolveHostname,
) {
  const url = parseSafeHttpUrl(input);
  await assertPublicHostname(url.hostname, resolveHostname);
  return url;
}

export function isLocalhostName(hostname: string) {
  const normalized = hostname.toLowerCase().replace(/\.$/, "");
  return normalized === "localhost" || normalized.endsWith(".localhost");
}

export function isPrivateOrReservedAddress(address: string) {
  const ipv4 = parseIpv4(address);

  if (ipv4) {
    return isPrivateOrReservedIpv4(ipv4);
  }

  return isPrivateOrReservedIpv6(address);
}

function parseIpv4(address: string) {
  const parts = address.split(".");
  if (parts.length !== 4) return null;

  const bytes = parts.map((part) => Number(part));
  if (bytes.some((byte) => !Number.isInteger(byte) || byte < 0 || byte > 255)) {
    return null;
  }

  return bytes as [number, number, number, number];
}

function isPrivateOrReservedIpv4([a, b]: [number, number, number, number]) {
  if (a === 0) return true;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 192 && b === 0) return true;
  if (a === 192 && b === 2) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a === 198 && b === 51) return true;
  if (a === 203 && b === 0) return true;
  if (a >= 224) return true;

  return false;
}

function isPrivateOrReservedIpv6(address: string) {
  const normalized = address.toLowerCase();

  if (normalized === "::" || normalized === "::1") return true;
  if (normalized.startsWith("::ffff:")) {
    const mapped = normalized.replace("::ffff:", "");
    const ipv4 = parseIpv4(mapped);
    return ipv4 ? isPrivateOrReservedIpv4(ipv4) : true;
  }
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (/^fe[89ab]/.test(normalized)) return true;
  if (normalized.startsWith("ff")) return true;
  if (normalized.startsWith("2001:db8")) return true;

  return false;
}
