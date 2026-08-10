import type { RawLeadImportRow } from "@/lib/leads/schema";

export function normalizeName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(hospital|hospitals|clinic|clinics|centre|center)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeCity(value: string | null | undefined) {
  if (!value) return null;

  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return normalized.length > 0 ? normalized : null;
}

export function normalizePhone(value: string | null | undefined) {
  if (!value) return null;

  const digits = value.replace(/\D/g, "");
  if (!digits) return null;

  const localNumber =
    digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;

  if (localNumber.length === 10) {
    return `+91${localNumber}`;
  }

  return digits;
}

export function normalizeEmail(value: string | null | undefined) {
  if (!value) return null;

  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

export function normalizeUrl(value: string | null | undefined) {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const url = new URL(candidate);
    url.hash = "";
    url.search = "";

    const hostname = url.hostname.replace(/^www\./i, "").toLowerCase();
    const pathname = url.pathname.replace(/\/+$/, "");
    const port = url.port ? `:${url.port}` : "";

    return `${url.protocol}//${hostname}${port}${pathname}`;
  } catch {
    return trimmed;
  }
}

export function buildImportFingerprint(
  row: Pick<
    RawLeadImportRow,
    "hospital_name" | "city" | "known_phone" | "known_website"
  >,
) {
  const normalizedName = normalizeName(row.hospital_name);
  const normalizedCity = normalizeCity(row.city);
  const normalizedPhone = normalizePhone(row.known_phone);
  const normalizedWebsite = normalizeUrl(row.known_website);

  return [
    normalizedName,
    normalizedCity ?? "unknown-city",
    normalizedPhone ?? normalizedWebsite ?? "no-contact",
  ].join("|");
}
