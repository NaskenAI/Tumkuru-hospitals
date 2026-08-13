/**
 * Top-level normalizer (Sections 3–5). Assembles the typed NormalizedHospital
 * from crawled first-party pages, preserving evidence and NEVER silently losing
 * a page: a page that cannot be parsed is recorded in coverage.unparsed and the
 * rest of the model is preserved. The result is validated against the schema.
 */

import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";

import { parseAccreditations } from "@/lib/normalize/accreditation";
import { parseContact } from "@/lib/normalize/contact";
import {
  isDoctorListPage,
  parseDoctorDetailPage,
  parseDoctorListPage,
  resolvePeople,
  type DoctorSlot,
} from "@/lib/normalize/doctors";
import { makeEvidence } from "@/lib/normalize/evidence";
import { parseFacilities } from "@/lib/normalize/facilities";
import { parseInsurers } from "@/lib/normalize/insurers";
import { parseMilestones } from "@/lib/normalize/milestones";
import {
  parseNormalizedHospital,
  type Coverage,
  type HospitalStatus,
  type NormalizedAsset,
  type NormalizedHospital,
  type Specialty,
  type SourcePage,
} from "@/lib/normalize/model";
import { parsePositioningClaims } from "@/lib/normalize/positioning";
import { computeProminence, normalizeSpecialtyLabel } from "@/lib/normalize/specialties";
import { collapseWs, containsSuperlative, isPlaceholderText } from "@/lib/normalize/text";

export type NormalizeInput = {
  pages: SourcePage[];
  /** Total pages discovered (may exceed crawled). Defaults to pages.length. */
  pagesDiscovered?: number;
  /** Pre-normalized first-party assets (from the live asset adapter). */
  assets?: NormalizedAsset[];
};

function visibleText($: CheerioAPI): string {
  $("script,style,noscript,svg").remove();
  return collapseWs($("body").text());
}

function headings($: CheerioAPI): string[] {
  return $("h1,h2,h3,h4,h5,h6")
    .map((_i, el) => collapseWs($(el).text()))
    .get()
    .filter(Boolean);
}

function shortBlocks($: CheerioAPI): string[] {
  return $("p,li,h1,h2,h3,h4,h5,h6")
    .map((_i, el) => collapseWs($(el).text()))
    .get()
    .filter((t) => t && t.length <= 200);
}

function sentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/).map(collapseWs).filter(Boolean);
}

function extractHospitalName($: CheerioAPI): string | null {
  const title = collapseWs($("title").text());
  const seg = collapseWs(title.split(/[»|·\-–—]/)[0] ?? "");
  if (seg && !containsSuperlative(seg) && /hospital|clinic|medical|healthcare|nursing home|multispeciality|multispecialty/i.test(seg)) {
    return seg;
  }
  const h1 = collapseWs($("h1").first().text());
  if (h1 && !containsSuperlative(h1)) return h1;
  return seg || h1 || null;
}

function isDetailPage(url: string): boolean {
  return /\/our-doctors\/[^/]+\/?$|\/(about-founder|doctor|profile)\//i.test(url);
}

/**
 * Establishment of the HOSPITAL — never the predecessor clinic, never a
 * copyright/footer year. If only clinic-founding evidence exists, value stays
 * null with entity="predecessor clinic" so the distinction is explicit.
 */
function deriveEstablishment(
  cands: { text: string; page: SourcePage; pageText: string }[],
): NormalizedHospital["established"] {
  const yearOf = (t: string) => {
    const m = t.match(/\b(19|20)\d{2}\b/);
    return m ? Number(m[0]) : null;
  };
  const usable = cands.filter(
    (c) => !/©|\(c\)|copyright|all rights reserved/i.test(c.text) && yearOf(c.text),
  );
  const hosp = usable.find(
    (c) => /\bhospital\b/i.test(c.text) && /(establish|inaugurat|found)/i.test(c.text),
  );
  if (hosp) {
    const year = yearOf(hosp.text)!;
    const month = hosp.text.toLowerCase().match(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/);
    const precision: "year" | "month" = month ? "month" : "year";
    return {
      value: year,
      precision,
      entity: "hospital",
      evidence: [makeEvidence(hosp.page, { excerpt: hosp.text.slice(0, 160), pageText: hosp.pageText })],
    };
  }
  const clinic = usable.find(
    (c) => /\bclinic\b/i.test(c.text) && /(establish|found)/i.test(c.text),
  );
  if (clinic) {
    return {
      value: null,
      precision: "unknown",
      entity: "predecessor clinic",
      evidence: [makeEvidence(clinic.page, { excerpt: clinic.text.slice(0, 160), pageText: clinic.pageText })],
    };
  }
  return { value: null, precision: "unknown", entity: null, evidence: [] };
}

export function normalizeHospital(input: NormalizeInput): NormalizedHospital {
  const { pages } = input;
  const coverage: Coverage = {
    pagesDiscovered: input.pagesDiscovered ?? pages.length,
    pagesCrawled: pages.length,
    pagesParsed: 0,
    unparsed: [],
  };

  type Loaded = { page: SourcePage; $: CheerioAPI; text: string };
  const loaded: Loaded[] = [];
  for (const page of pages) {
    try {
      if (!page.html || !collapseWs(page.html)) throw new Error("empty document");
      const $ = cheerio.load(page.html);
      const text = visibleText(cheerio.load(page.html)); // fresh load: keep $ intact
      loaded.push({ page, $, text });
      coverage.pagesParsed += 1;
    } catch (e) {
      coverage.unparsed.push({
        url: page.url,
        reason: e instanceof Error ? e.message : "parse error",
        parser: "load",
      });
    }
  }

  // --- Doctors -------------------------------------------------------------
  const slots: DoctorSlot[] = [];
  for (const { page, text } of loaded) {
    try {
      if (isDetailPage(page.url)) {
        const s = parseDoctorDetailPage(cheerio.load(page.html), page, text);
        if (s) slots.push(s);
      }
      if (isDoctorListPage(cheerio.load(page.html))) {
        slots.push(...parseDoctorListPage(cheerio.load(page.html), page, text));
      }
    } catch (e) {
      coverage.unparsed.push({ url: page.url, reason: String(e), parser: "doctors" });
    }
  }
  const people = resolvePeople(slots);

  // --- Specialties (from doctor groups + department headings) --------------
  const specialtyAcc = new Map<string, { spec: Specialty; personCount: number }>();
  const clinicalSlots = slots.filter((s) => s.role === "clinician" && s.group !== "Profile" && s.group !== "General");
  for (const s of clinicalSlots) {
    const n = normalizeSpecialtyLabel(s.group);
    const key = n.display_label.toLowerCase();
    const existing = specialtyAcc.get(key);
    if (existing) {
      existing.personCount += 1;
      existing.spec.evidence.push(s.evidence);
    } else {
      specialtyAcc.set(key, {
        personCount: 1,
        spec: { ...n, prominence: 0, evidence: [s.evidence] },
      });
    }
  }
  const homeText = loaded.find((l) => /\/$|home/i.test(l.page.url))?.text ?? "";
  const specialties: Specialty[] = [...specialtyAcc.values()].map(({ spec, personCount }) => ({
    ...spec,
    prominence: computeProminence({
      personCount,
      dedicatedDepartmentPage: false,
      dedicatedFacility: false,
      homepageOrMetaMention: new RegExp(spec.display_label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(homeText),
    }),
  }));

  // --- Facilities / insurers (page-scoped) ---------------------------------
  let facilities: NormalizedHospital["facilities"] = [];
  let insurers: NormalizedHospital["insurers"] = [];
  for (const { page, text } of loaded) {
    if (page.pageType === "FACILITIES" || /facilit/i.test(page.url)) {
      try {
        facilities = facilities.concat(parseFacilities(cheerio.load(page.html), page, text));
      } catch (e) {
        coverage.unparsed.push({ url: page.url, reason: String(e), parser: "facilities" });
      }
    }
    if (page.pageType === "INSURANCE" || /insur/i.test(page.url)) {
      try {
        insurers = insurers.concat(parseInsurers(cheerio.load(page.html), page, text));
      } catch (e) {
        coverage.unparsed.push({ url: page.url, reason: String(e), parser: "insurers" });
      }
    }
  }

  // --- Accreditation / milestones / positioning (text-scanned) -------------
  const accreditations: NormalizedHospital["accreditations"] = [];
  const milestones: NormalizedHospital["narrative"]["milestones"] = [];
  const positioningClaims: NormalizedHospital["positioningClaims"] = [];
  for (const { page, $, text } of loaded) {
    const candidates = [...headings($), ...shortBlocks($), ...sentences(text)];
    accreditations.push(...parseAccreditations(candidates, page, text));
    positioningClaims.push(...parsePositioningClaims([collapseWs($("title").text()), ...candidates], page, text));
    if (page.pageType === "ABOUT" || /milestone|about|founder|history/i.test(page.url)) {
      milestones.push(...parseMilestones(candidates, page, text));
    }
  }

  // --- Narrative (placeholder- and superlative-filtered) -------------------
  const about: NormalizedHospital["narrative"]["about"] = [];
  let founder: NormalizedHospital["narrative"]["founder"];
  for (const { page, $, text } of loaded) {
    if (!(page.pageType === "ABOUT" || /about|founder|highlights/i.test(page.url))) continue;
    $("p").each((_i, el) => {
      const t = collapseWs($(el).text());
      if (t.length < 40 || t.length > 600) return;
      if (isPlaceholderText(t)) return; // reject lorem ipsum / editor boilerplate
      if (containsSuperlative(t)) return; // marketing → positioning only
      about.push({ text: t, evidence: [makeEvidence(page, { excerpt: t, pageText: text })] });
    });
    const fm = text.match(/(?:founded|established|started|inaugurated)[^.]*?\bby\s+(Dr\.?\s+[A-Z][A-Za-z.\s]{2,40})/i);
    if (fm && !founder) {
      const name = collapseWs(fm[1]);
      founder = { name, evidence: [makeEvidence(page, { excerpt: collapseWs(fm[0]).slice(0, 160), pageText: text })] };
    }
  }

  // --- Contact / location / appointment / emergency ------------------------
  const { contact, location, appointment, emergency } = parseContact(
    loaded.map((l) => ({ page: l.page, pageText: l.text, html: l.page.html })),
  );

  // --- Hospital establishment (distinct from predecessor clinic) -----------
  const estCands: { text: string; page: SourcePage; pageText: string }[] = [];
  for (const { page, text } of loaded) {
    if (!(page.pageType === "ABOUT" || page.pageType === "HOME" || /about|founder|milestone|history|highlights|\/$/i.test(page.url))) continue;
    for (const s of sentences(text)) estCands.push({ text: s, page, pageText: text });
  }
  const established = deriveEstablishment(estCands);

  // --- Hospital name -------------------------------------------------------
  let hospitalName: NormalizedHospital["hospitalName"];
  for (const { page, $, text } of loaded) {
    const name = extractHospitalName($);
    if (name) {
      hospitalName = { value: name, evidence: [makeEvidence(page, { excerpt: name, pageText: text })] };
      break;
    }
  }

  // --- Status --------------------------------------------------------------
  let status: HospitalStatus;
  if (coverage.pagesParsed === 0) status = "FAILED";
  else if (
    coverage.unparsed.length === 0 &&
    coverage.pagesParsed === coverage.pagesCrawled &&
    hospitalName !== undefined &&
    (people.doctors.length > 0 || specialties.length > 0)
  ) {
    status = "COMPLETE";
  } else {
    status = "PARTIAL";
  }

  const model: NormalizedHospital = {
    status,
    hospitalName,
    established,
    contact,
    location,
    emergency,
    appointment,
    accreditations: dedupeAccreditations(accreditations),
    people: { doctors: people.doctors, administrators: people.administrators, others: people.others },
    specialties,
    facilities,
    assets: input.assets ?? [],
    insurers,
    narrative: { about, founder, milestones: dedupeMilestones(milestones) },
    positioningClaims: dedupePositioning(positioningClaims),
    coverage,
  };

  return parseNormalizedHospital(model);
}

function dedupeAccreditations(items: NormalizedHospital["accreditations"]) {
  const seen = new Set<string>();
  return items.filter((a) => {
    const k = `${a.body}:${a.status}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
function dedupeMilestones(items: NormalizedHospital["narrative"]["milestones"]) {
  const seen = new Set<string>();
  return items.filter((m) => {
    const k = `${m.date.year}-${m.date.month ?? 0}-${m.label.slice(0, 40)}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
function dedupePositioning(items: NormalizedHospital["positioningClaims"]) {
  const seen = new Set<string>();
  return items.filter((p) => {
    const k = p.text.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
