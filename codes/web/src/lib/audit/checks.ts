/**
 * Deterministic website audit checks.
 *
 * Each check examines fetched HTML text for signals that the hospital's
 * current website is missing or weak. These are pure-function checks —
 * they take the raw HTML string and return boolean results.
 *
 * The source HTML should already be fetched via the safe-fetch module.
 */

import * as cheerio from "cheerio";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AuditCheckResult = {
  name: string;
  label: string;
  passed: boolean;
  detail: string;
};

export type WebsiteAuditResult = {
  websiteUrl: string | null;
  websiteExists: boolean;
  httpStatus: number | null;
  checks: AuditCheckResult[];
};

// ---------------------------------------------------------------------------
// Individual checks
// ---------------------------------------------------------------------------

export function checkHttps(url: string | null): AuditCheckResult {
  const passed = url !== null && url.startsWith("https://");
  return {
    name: "https",
    label: "HTTPS enabled",
    passed,
    detail: passed ? "Site uses HTTPS." : "Site does not use HTTPS.",
  };
}

export function checkMobileViewport(html: string): AuditCheckResult {
  const $ = cheerio.load(html);
  const viewport = $('meta[name="viewport"]').attr("content") ?? "";
  const passed = viewport.toLowerCase().includes("width=device-width");
  return {
    name: "mobile_viewport",
    label: "Mobile viewport",
    passed,
    detail: passed
      ? "Mobile viewport meta tag found."
      : "Missing mobile viewport meta tag.",
  };
}

export function checkTitleTag(html: string): AuditCheckResult {
  const $ = cheerio.load(html);
  const title = $("title").text().trim();
  const passed = title.length > 0;
  return {
    name: "title_tag",
    label: "Title tag",
    passed,
    detail: passed ? `Title: "${title.slice(0, 80)}"` : "Missing <title> tag.",
  };
}

export function checkMetaDescription(html: string): AuditCheckResult {
  const $ = cheerio.load(html);
  const desc =
    $('meta[name="description"]').attr("content")?.trim() ?? "";
  const passed = desc.length > 0;
  return {
    name: "meta_description",
    label: "Meta description",
    passed,
    detail: passed
      ? `Description: "${desc.slice(0, 100)}"`
      : "Missing meta description.",
  };
}

export function checkCallCta(html: string): AuditCheckResult {
  const $ = cheerio.load(html);
  const bodyText = $("body").text().toLowerCase();
  const hasLink = $('a[href^="tel:"]').length > 0;
  const hasText =
    bodyText.includes("call us") ||
    bodyText.includes("call now") ||
    bodyText.includes("phone");
  const passed = hasLink || hasText;
  return {
    name: "call_cta",
    label: "Call CTA",
    passed,
    detail: passed
      ? "Call to action or phone link found."
      : "No call CTA or tel: link found.",
  };
}

export function checkAppointmentCta(html: string): AuditCheckResult {
  const $ = cheerio.load(html);
  const bodyText = $("body").text().toLowerCase();
  const hasText =
    bodyText.includes("appointment") ||
    bodyText.includes("book now") ||
    bodyText.includes("book online") ||
    bodyText.includes("schedule");
  const passed = hasText;
  return {
    name: "appointment_cta",
    label: "Appointment CTA",
    passed,
    detail: passed
      ? "Appointment booking text found."
      : "No appointment CTA found.",
  };
}

export function checkWhatsappOrDirections(html: string): AuditCheckResult {
  const $ = cheerio.load(html);
  const bodyText = $("body").text().toLowerCase();
  const allHrefs = $("a")
    .map((_i, el) => $(el).attr("href")?.toLowerCase() ?? "")
    .get();

  const hasWhatsapp =
    bodyText.includes("whatsapp") ||
    allHrefs.some((h) => h.includes("wa.me") || h.includes("whatsapp"));
  const hasDirections =
    bodyText.includes("directions") ||
    bodyText.includes("google maps") ||
    allHrefs.some(
      (h) => h.includes("maps.google") || h.includes("goo.gl/maps"),
    );

  const passed = hasWhatsapp || hasDirections;
  return {
    name: "whatsapp_directions",
    label: "WhatsApp / Directions",
    passed,
    detail: passed
      ? `Found: ${[hasWhatsapp && "WhatsApp", hasDirections && "Directions"].filter(Boolean).join(", ")}`
      : "No WhatsApp or directions link found.",
  };
}

export function checkDoctorsListed(html: string): AuditCheckResult {
  const $ = cheerio.load(html);
  const bodyText = $("body").text().toLowerCase();
  const passed =
    bodyText.includes("dr.") ||
    bodyText.includes("doctor") ||
    bodyText.includes("physician") ||
    bodyText.includes("surgeon") ||
    bodyText.includes("mbbs") ||
    bodyText.includes("our team");
  return {
    name: "doctors_listed",
    label: "Doctors listed",
    passed,
    detail: passed
      ? "Doctor references found on the page."
      : "No doctor listings found.",
  };
}

export function checkSpecialtiesListed(html: string): AuditCheckResult {
  const $ = cheerio.load(html);
  const bodyText = $("body").text().toLowerCase();
  const passed =
    bodyText.includes("specialty") ||
    bodyText.includes("speciality") ||
    bodyText.includes("department") ||
    bodyText.includes("cardiology") ||
    bodyText.includes("orthop") ||
    bodyText.includes("gynec") ||
    bodyText.includes("pediatr") ||
    bodyText.includes("services");
  return {
    name: "specialties_listed",
    label: "Specialties listed",
    passed,
    detail: passed
      ? "Specialty or department references found."
      : "No specialty listings found.",
  };
}

export function checkOutdatedSignals(html: string): AuditCheckResult {
  const $ = cheerio.load(html);
  const bodyText = $("body").text().toLowerCase();

  const signals: string[] = [];
  if (bodyText.includes("under construction")) signals.push("under construction");
  if (bodyText.includes("coming soon")) signals.push("coming soon");
  if ($("marquee").length > 0) signals.push("<marquee> tag");
  if ($("blink").length > 0) signals.push("<blink> tag");
  if ($("table").length > 3 && $("div").length < 5) signals.push("table-based layout");
  if (bodyText.includes("copyright 2019") || bodyText.includes("copyright 2018") || bodyText.includes("copyright 2017") || bodyText.includes("© 2019") || bodyText.includes("© 2018") || bodyText.includes("© 2017")) {
    signals.push("outdated copyright");
  }

  const passed = signals.length === 0;
  return {
    name: "not_outdated",
    label: "Not outdated",
    passed,
    detail: passed
      ? "No outdated signals detected."
      : `Outdated signals: ${signals.join(", ")}`,
  };
}

// ---------------------------------------------------------------------------
// DEFERRED — not required for pilot
//
// Two audit checks are intentionally NOT implemented for the pilot:
//   - Broken-link testing: would require fetching every outbound link, which
//     re-opens the SSRF surface and is slow. Deferred.
//   - Real load-time / performance testing: needs a headless browser + timing
//     harness. Deferred.
// These are documented as deferred rather than stubbed, so nothing implies they
// work. The checks below all run against real fetched HTML.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Run all checks
// ---------------------------------------------------------------------------

export function runAllAuditChecks(input: {
  websiteUrl: string | null;
  httpStatus: number | null;
  rawHtml: string | null;
}): WebsiteAuditResult {
  const websiteExists =
    input.httpStatus !== null &&
    input.httpStatus >= 200 &&
    input.httpStatus < 400;

  if (!input.rawHtml || !websiteExists) {
    return {
      websiteUrl: input.websiteUrl,
      websiteExists: false,
      httpStatus: input.httpStatus,
      checks: [
        checkHttps(input.websiteUrl),
        {
          name: "website_exists",
          label: "Website exists",
          passed: false,
          detail: input.websiteUrl
            ? `Website returned HTTP ${input.httpStatus ?? "no response"}.`
            : "No website URL on record.",
        },
      ],
    };
  }

  return {
    websiteUrl: input.websiteUrl,
    websiteExists: true,
    httpStatus: input.httpStatus,
    checks: [
      { name: "website_exists", label: "Website exists", passed: true, detail: "Website is reachable." },
      checkHttps(input.websiteUrl),
      checkMobileViewport(input.rawHtml),
      checkTitleTag(input.rawHtml),
      checkMetaDescription(input.rawHtml),
      checkCallCta(input.rawHtml),
      checkAppointmentCta(input.rawHtml),
      checkWhatsappOrDirections(input.rawHtml),
      checkDoctorsListed(input.rawHtml),
      checkSpecialtiesListed(input.rawHtml),
      checkOutdatedSignals(input.rawHtml),
    ],
  };
}
