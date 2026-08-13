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
      const val = m[0].toLowerCase();
      const key = val;
      const e = emailMap.get(key) ?? { value: val, evidence: [] };
      e.evidence.push(makeEvidence(page, { excerpt: m[0], pageText }));
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

  // Location — best-effort address line (a line containing a 6-digit pincode).
  const location: Location = {};
  for (const { page, pageText } of pages) {
    const line = pageText.split(/[\n·|]/).map(collapseWs).find((l) => PINCODE_RE.test(l) && l.length < 160 && /[a-z]/i.test(l));
    if (line) {
      location.address = { value: line, evidence: [makeEvidence(page, { excerpt: line, pageText })] };
      const pin = line.match(PINCODE_RE);
      if (pin) location.postalCode = { value: pin[0], evidence: [makeEvidence(page, { excerpt: pin[0], pageText })] };
      break;
    }
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

  // Emergency — only from explicit evidence.
  let emergency: Emergency = { available: "unknown", evidence: [] };
  for (const { page, pageText } of pages) {
    const m = pageText.match(/[^.]*\b(24\s*[x/×]\s*7|24\/7|round[- ]the[- ]clock)\b[^.]*\b(emergency|casualty|trauma)\b[^.]*/i)
      || pageText.match(/[^.]*\bemergency (services?|care)\b (available|24)[^.]*/i);
    if (m) {
      emergency = { available: true, text: collapseWs(m[0]).slice(0, 120), evidence: [makeEvidence(page, { excerpt: collapseWs(m[0]).slice(0, 120), pageText })] };
      break;
    }
  }

  return { contact, location, appointment, emergency };
}
