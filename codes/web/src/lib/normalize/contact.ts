/**
 * Contact / location / appointment / emergency (Sections 25–26).
 * Communication channels stay separate: a phone number NEVER implies WhatsApp
 * or appointment capability. Disagreeing values across pages are preserved as
 * conflicts, not silently resolved.
 */

import type { CheerioAPI } from "cheerio";
import * as cheerio from "cheerio";

import { makeEvidence } from "@/lib/normalize/evidence";
import type { Appointment, Contact, Emergency, Location, SourcePage } from "@/lib/normalize/model";
import { collapseWs } from "@/lib/normalize/text";

const MOBILE_RE = /(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}\b/g;
const LANDLINE_RE = /\b0\d{2,4}[\s-]?\d{6,8}\b/g;
const EMAIL_RE = /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/gi;
const PINCODE_RE = /\b\d{6}\b/;

function phoneDigits(s: string): string {
  return s.replace(/\D/g, "").replace(/^91/, "").replace(/^0/, "");
}

export type ContactPageInput = { page: SourcePage; pageText: string; html: string };

export function parseContact(pages: ContactPageInput[]): {
  contact: Contact;
  location: Location;
  appointment: Appointment;
  emergency: Emergency;
} {
  const phoneMap = new Map<string, { value: string; evidence: ReturnType<typeof makeEvidence>[] }>();
  const emailMap = new Map<string, { value: string; evidence: ReturnType<typeof makeEvidence>[] }>();

  for (const { page, pageText } of pages) {
    for (const m of pageText.matchAll(MOBILE_RE)) collectPhone(m[0]);
    for (const m of pageText.matchAll(LANDLINE_RE)) collectPhone(m[0]);
    for (const m of pageText.matchAll(EMAIL_RE)) {
      // Flattened text can concatenate an adjacent phone into the local part
      // ("…944011info@…"). Strip a long leading digit-run before letters.
      const val = m[0].toLowerCase().replace(/^\d{4,}(?=[a-z])/, "");
      const key = val;
      const e = emailMap.get(key) ?? { value: val, evidence: [] };
      e.evidence.push(makeEvidence(page, { excerpt: val, pageText }));
      emailMap.set(key, e);
    }
    function collectPhone(raw: string) {
      const key = phoneDigits(raw);
      if (key.length < 7) return;
      const e = phoneMap.get(key) ?? { value: collapseWs(raw), evidence: [] };
      e.evidence.push(makeEvidence(page, { excerpt: raw, pageText }));
      phoneMap.set(key, e);
    }
  }

  const phones = [...phoneMap.values()];
  const emails = [...emailMap.values()];
  // Only the primary single-valued channel (phone) is treated as a conflict
  // when it disagrees across pages. Multiple emails are legitimately multi-valued
  // (info@, appointments@, …) and are kept as candidates, not flagged.
  const conflicts: Contact["conflicts"] = [];
  if (phones.length > 1) conflicts.push({ field: "phone", values: phones });

  const contact: Contact = { phones, emails, conflicts };

  // Location — best-effort: a window ending at a 6-digit pincode (robust to
  // whitespace-flattened WP text where clean "lines" don't exist).
  const location: Location = {};
  for (const { page, pageText } of pages) {
    const text = collapseWs(pageText);
    const m = PINCODE_RE.exec(text);
    if (!m) continue;
    const end = m.index + m[0].length;
    // grab up to ~110 chars before the pincode, then trim leading noise so the
    // address starts at a capitalized token / house number.
    let addr = collapseWs(text.slice(Math.max(0, m.index - 130), end));
    // Drop leading header noise (social/phone/email) — keep from the last email
    // or a recognizable address anchor onward.
    addr = addr.replace(/^.*@\S+\s*/, "");
    const anchor = addr.match(/(near|opp\.?|opposite|beside|behind|plot|door\s*no|#\s*\d|\bno\.?\s*\d|\d{1,4}(?:st|nd|rd|th)?\s+(?:main|cross|road|street|stage|block|phase|nagar))/i);
    if (anchor && anchor.index && anchor.index > 0) addr = addr.slice(anchor.index);
    addr = collapseWs(addr.replace(/^[^A-Za-z0-9#]*/, ""));
    if (addr.length < 8 || addr.length > 160) continue;
    location.address = { value: addr, evidence: [makeEvidence(page, { excerpt: addr, pageText })] };
    location.postalCode = { value: m[0], evidence: [makeEvidence(page, { excerpt: m[0], pageText })] };
    const cityM = addr.match(/([A-Z][a-z]+)\s*[-–]\s*\d{6}/);
    if (cityM) location.city = { value: cityM[1], evidence: [makeEvidence(page, { excerpt: cityM[0], pageText })] };
    break;
  }

  // Appointment — explicit channels only; never inferred from a phone number.
  let appointment: Appointment = { channel: "none", evidence: [] };
  for (const { page, pageText, html } of pages) {
    const $: CheerioAPI = cheerio.load(html);
    const wa = $("a[href*='wa.me'], a[href*='whatsapp']").first().attr("href");
    if (wa) {
      appointment = { channel: "whatsapp", value: wa, evidence: [makeEvidence(page, { excerpt: "WhatsApp link", pageText })] };
      break;
    }
    const apptLink = $("a").filter((_i, a) => /appoint|book (a )?(consultation|appointment)/i.test($(a).text())).first().attr("href");
    if (apptLink) {
      appointment = { channel: "page", value: apptLink, evidence: [makeEvidence(page, { excerpt: "Appointment link", pageText })] };
      break;
    }
    if (page.pageType === "APPOINTMENT") {
      appointment = { channel: "page", value: page.url, evidence: [makeEvidence(page, { excerpt: page.url })] };
      break;
    }
  }

  // Emergency — only from explicit evidence. Use a tight window around the
  // keyword (flattened WP text has no sentence breaks around the nav).
  let emergency: Emergency = { available: "unknown", evidence: [] };
  const EMERGENCY_RE = /(24\s*[x/×]\s*7|24\s*\/\s*7|round[- ]the[- ]clock)[^.]{0,30}(emergency|casualty|trauma)|(emergency|casualty)\s+(services?|care|department|ward)\b[^.]{0,20}(available|24|round)?/i;
  for (const { page, pageText } of pages) {
    const text = collapseWs(pageText);
    const m = EMERGENCY_RE.exec(text);
    if (m) {
      const win = collapseWs(text.slice(Math.max(0, m.index), m.index + Math.min(90, m[0].length + 40)));
      emergency = { available: true, text: win, evidence: [makeEvidence(page, { excerpt: win, pageText })] };
      break;
    }
  }

  return { contact, location, appointment, emergency };
}
