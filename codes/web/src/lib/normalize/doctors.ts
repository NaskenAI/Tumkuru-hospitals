/**
 * Deterministic doctor parsing + entity resolution (Sections 6–9).
 *
 * Doctor-bearing pages are detected by SEMANTIC STRUCTURE (repeated specialty
 * headings each followed by one or more name blocks), never by URL. A specialty
 * heading may be followed by MULTIPLE sibling blocks — all are captured until
 * the next section boundary. Administrative sections yield administrators, kept
 * out of the clinical collection. Similar names are never silently merged:
 * ambiguity is surfaced as a resolution state with collision links.
 */

import type { CheerioAPI } from "cheerio";

import { makeEvidence } from "@/lib/normalize/evidence";
import type { Evidence, Person, PersonRole, SourcePage } from "@/lib/normalize/model";
import { collapseWs, nameTokens, normalizeDoctorName } from "@/lib/normalize/text";

export type DoctorSlot = {
  rawName: string;
  group: string;
  role: PersonRole;
  detailUrl?: string;
  evidence: Evidence;
};

const ADMIN_HEADING_RE =
  /\b(administration|administrative|management team|\bmanagement\b|\bceo\b|\bcoo\b|\bcfo\b|\bcto\b|director|directors|board|governing|trustee|non[- ]?clinical|our staff|support staff|accounts|human resources|\bhr\b)\b/i;

// Generic "this is the team page" titles — a section title, not a specialty.
const PAGE_TITLE_RE =
  /^(doctors?|our doctors|our team|our specialists|meet (the|our) team|medical team|team|consultants?|our consultants|specialists?|faculty|experts?)$/i;

const ADMIN_TITLE_RE =
  /^(colonel|col\.?|major|maj\.?|captain|capt\.?|brig\.?|brigadier|mr\.?|mrs\.?|ms\.?|prof\.?|shri|smt\.?)\s+[a-z]/i;

/** Split a flattened block ("Dr A Dr B C") into individual "Dr …" names. */
export function splitDoctorNames(blockText: string): string[] {
  const text = collapseWs(blockText);
  if (!/\bDr\b/i.test(text)) return [];
  // Split at whitespace that immediately precedes another "Dr" name token.
  return text
    .split(/\s+(?=Dr\b\.?\s)/i)
    .map((s) => collapseWs(s))
    .filter((s) => /^Dr\b/i.test(s))
    // A name is short; a sentence beginning with "Dr" is prose, not a name.
    .filter((s) => s.length <= 48 && nameTokens(s).length >= 1 && nameTokens(s).length <= 6)
    // reject prose fragments (commas / mid-string sentence punctuation)
    .filter((s) => !/[,;:]/.test(s) && !/\.\s/.test(s));
}

function contentRoot($: CheerioAPI) {
  $("script,style,noscript,nav,header,footer").remove();
  if ($(".entry-content").length) return $(".entry-content").first();
  if ($("main").length) return $("main").first();
  return $("body");
}

/** Is the page a doctor-bearing LIST page (semantic, not URL-based)? */
export function isDoctorListPage($: CheerioAPI): boolean {
  const root = contentRoot($);
  let groupsWithNames = 0;
  for (const h of root.find("h2,h3,h4").toArray()) {
    let node = $(h).next();
    let hops = 0;
    while (node.length && !/^h[1-6]$/i.test(node.get(0)?.tagName ?? "") && hops < 6) {
      if (splitDoctorNames(node.text()).length > 0) {
        groupsWithNames += 1;
        break;
      }
      node = node.next();
      hops += 1;
    }
  }
  return groupsWithNames >= 2;
}

/**
 * Parse a doctor LIST page into raw slots (one per name occurrence per group).
 * Walks the content in document order, tracking the current section heading and
 * whether that section is clinical or administrative. Multiple name blocks under
 * one heading are all captured (until the next heading).
 */
export function parseDoctorListPage(
  $: CheerioAPI,
  page: SourcePage,
  pageText: string,
): DoctorSlot[] {
  const root = contentRoot($);
  const slots: DoctorSlot[] = [];
  let currentGroup: string | null = null;
  let currentRole: PersonRole = "clinician";
  let sawGroupHeading = false;

  root.find("h1,h2,h3,h4,h5,h6,p,li").each((_i, el) => {
    const tag = el.tagName.toLowerCase();
    const isHeading = /^h[1-6]$/.test(tag);
    const text = isHeading
      ? collapseWs($(el).clone().children().remove().end().text()) || collapseWs($(el).text())
      : collapseWs($(el).text());
    if (!text) return;

    if (isHeading) {
      if (PAGE_TITLE_RE.test(text)) {
        currentGroup = null;
        currentRole = "clinician";
        return;
      }
      currentRole = ADMIN_HEADING_RE.test(text) ? "administrator" : "clinician";
      currentGroup = text;
      sawGroupHeading = true;
      return;
    }

    const ev = makeEvidence(page, { excerpt: text, pageText });
    const names = splitDoctorNames(text);
    if (names.length > 0) {
      for (const n of names) {
        slots.push({ rawName: n, group: currentGroup ?? "General", role: currentRole, evidence: ev });
      }
      return;
    }
    // Administrator named without a "Dr" prefix (e.g. "Colonel … (Retired)").
    if (
      currentRole === "administrator" &&
      sawGroupHeading &&
      ADMIN_TITLE_RE.test(text) &&
      text.length <= 60
    ) {
      slots.push({
        rawName: text.replace(/\s*\(retired\)\s*/i, "").trim(),
        group: currentGroup ?? "Administration",
        role: "administrator",
        evidence: ev,
      });
    }
  });

  return slots;
}

/** Parse a single-doctor DETAIL page (e.g. /our-doctors/dr-x/, /about-founder/). */
export function parseDoctorDetailPage(
  $: CheerioAPI,
  page: SourcePage,
  pageText: string,
): DoctorSlot | null {
  const title = collapseWs($("h1").first().text()) || collapseWs($("title").text());
  const m = title.match(/Dr\.?\s+[A-Z][A-Za-z.\s]{1,40}/);
  if (!m) return null;
  const rawName = collapseWs(m[0]);
  if (nameTokens(rawName).length < 1) return null;
  return {
    rawName,
    group: "Profile",
    role: "clinician",
    detailUrl: page.url,
    evidence: makeEvidence(page, { excerpt: title, pageText }),
  };
}

function tokensSubset(a: string[], b: string[]): boolean {
  return a.length > 0 && a.length < b.length && a.every((t) => b.includes(t));
}

/**
 * Resolve raw slots into distinct people WITHOUT merging similar names. Exact
 * same normalized spelling collapses into one person (with multiple group
 * memberships); everything else stays separate, with collisions surfaced.
 */
export function resolvePeople(slots: DoctorSlot[]): {
  doctors: Person[];
  administrators: Person[];
  others: Person[];
  observedNameSlots: number;
} {
  type Acc = {
    displayName: string;
    rawNames: Set<string>;
    groups: Set<string>;
    role: PersonRole;
    detailUrl?: string;
    evidence: Evidence[];
  };
  const byName = new Map<string, Acc>();
  const order: string[] = [];

  for (const s of slots) {
    const display = normalizeDoctorName(s.rawName);
    let acc = byName.get(display);
    if (!acc) {
      acc = { displayName: display, rawNames: new Set(), groups: new Set(), role: s.role, evidence: [] };
      byName.set(display, acc);
      order.push(display);
    }
    acc.rawNames.add(collapseWs(s.rawName));
    acc.groups.add(s.group);
    if (s.detailUrl) acc.detailUrl = s.detailUrl;
    // A person counts as clinical if ANY occurrence is clinical.
    if (s.role === "clinician") acc.role = "clinician";
    acc.evidence.push(s.evidence);
  }

  const persons: Person[] = order.map((name, i) => {
    const a = byName.get(name)!;
    return {
      id: `person_${String(i + 1).padStart(3, "0")}`,
      displayName: a.displayName,
      rawNames: [...a.rawNames],
      role: a.role,
      sourceGroups: [...a.groups],
      detailUrl: a.detailUrl,
      resolution: { state: "confident", collidesWith: [], reason: undefined },
      evidence: a.evidence,
    };
  });

  // Collision detection: a shorter name whose tokens are a subset of a fuller
  // name is a potential alias — surfaced, never merged.
  for (const p of persons) {
    const tp = nameTokens(p.displayName);
    for (const q of persons) {
      if (p === q) continue;
      if (tokensSubset(tp, nameTokens(q.displayName))) p.resolution.collidesWith.push(q.id);
    }
  }

  for (const p of persons) {
    const t = nameTokens(p.displayName);
    if (t.length === 0) {
      p.resolution.state = "unresolved";
      p.resolution.reason = "no parseable name tokens";
    } else if (p.resolution.collidesWith.length > 0) {
      p.resolution.state = "ambiguous";
      p.resolution.reason = "short name is a token-subset of one or more fuller names";
    } else if (t.length === 1 && p.sourceGroups.filter((g) => g !== "Profile").length > 1) {
      p.resolution.state = "ambiguous";
      p.resolution.reason = "single-token name occurs in multiple specialty groups";
    } else {
      p.resolution.state = "confident";
    }
  }

  return {
    doctors: persons.filter((p) => p.role === "clinician"),
    administrators: persons.filter((p) => p.role === "administrator"),
    others: persons.filter((p) => p.role === "other"),
    observedNameSlots: slots.length,
  };
}
