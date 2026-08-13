/**
 * Deterministic selection helpers for NASKEN_HOSPITAL_V1 (Task 2).
 *
 * Pure functions over the NormalizedHospital model — same input, same output.
 * Nothing here is hospital-specific; selection is driven by normalized
 * prominence / relevance / approval state, never by names or filenames.
 */

import { isPubliclyEligible } from "@/lib/normalize/assets";
import { scoreHeroCandidate } from "@/lib/normalize/hero";
import type { Facility, Milestone, NormalizedAsset, NormalizedHospital, Person, Specialty } from "@/lib/normalize/model";
import { titleCaseLabel } from "@/lib/normalize/text";

function heroScore(a: NormalizedAsset): number {
  return scoreHeroCandidate({
    asset_id: a.asset_id,
    classification: a.classification,
    width: a.width ?? undefined,
    height: a.height ?? undefined,
    og_declared: a.og_declared,
    is_photograph: a.is_photograph,
    crowding: a.crowding,
  }).total;
}

/** The best publicly-eligible exterior/interior photograph, or null. */
export function selectHero(model: NormalizedHospital): NormalizedAsset | null {
  const candidates = model.assets.filter(
    (a) =>
      isPubliclyEligible(a.approval_state) &&
      a.is_photograph &&
      (a.classification === "EXTERIOR" || a.classification === "INTERIOR"),
  );
  const ranked = candidates
    .map((a) => ({ a, s: heroScore(a) }))
    .sort((x, y) => y.s - x.s || x.a.asset_id.localeCompare(y.a.asset_id));
  return ranked[0] && ranked[0].s > 0 ? ranked[0].a : null;
}

/** A safe non-attributive photo for the About section (never the hero). */
export function selectAboutImage(model: NormalizedHospital, excludeId?: string): NormalizedAsset | null {
  const candidates = model.assets.filter(
    (a) =>
      a.asset_id !== excludeId &&
      isPubliclyEligible(a.approval_state) &&
      a.is_photograph &&
      (a.classification === "EXTERIOR" || a.classification === "INTERIOR" || a.classification === "OTHER"),
  );
  const ranked = candidates
    .map((a) => ({ a, s: heroScore(a) }))
    .sort((x, y) => y.s - x.s || x.a.asset_id.localeCompare(y.a.asset_id));
  return ranked[0]?.a ?? null;
}

/** Top N specialties by prominence (deterministic tie-break by label). */
export function selectFeaturedSpecialties(model: NormalizedHospital, n = 6): Specialty[] {
  return [...model.specialties]
    .sort((a, b) => b.prominence - a.prominence || a.display_label.localeCompare(b.display_label))
    .slice(0, n);
}

/** Up to N patient-relevant facilities with a real (non-filename) caption. */
export function selectFeaturedFacilities(model: NormalizedHospital, n = 6): Facility[] {
  const seen = new Set<string>();
  return [...model.facilities]
    .filter((f) => f.patient_relevance >= 2 && f.caption_source !== "filename" && f.caption_source !== "none")
    .sort((a, b) => b.patient_relevance - a.patient_relevance || a.display_label.localeCompare(b.display_label))
    .filter((f) => {
      const k = f.display_label.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, n);
}

export type DoctorGroup = { sourceLabel: string; label: string; names: string[]; total: number };

/**
 * Group clinicians by their source specialty group, ordered by specialty
 * prominence then group size. Names only — no photos, no invented profiles.
 */
export function selectDoctorGroups(model: NormalizedHospital, maxGroups = 6, perGroup = 6): DoctorGroup[] {
  const prominence = new Map<string, number>();
  const displayFor = new Map<string, string>();
  for (const s of model.specialties) {
    prominence.set(s.source_label.toLowerCase(), s.prominence);
    displayFor.set(s.source_label.toLowerCase(), s.display_label);
  }

  const byGroup = new Map<string, { names: string[]; seen: Set<string> }>();
  for (const p of model.people.doctors as Person[]) {
    for (const g of p.sourceGroups) {
      if (g === "Profile" || g === "General") continue;
      const key = g.toLowerCase();
      let bucket = byGroup.get(key);
      if (!bucket) {
        bucket = { names: [], seen: new Set() };
        byGroup.set(key, bucket);
      }
      if (!bucket.seen.has(p.displayName)) {
        bucket.seen.add(p.displayName);
        bucket.names.push(p.displayName);
      }
    }
  }

  return [...byGroup.entries()]
    .map(([key, v]) => ({
      sourceLabel: key,
      label: displayFor.get(key) ?? titleCaseLabel(key),
      names: v.names,
      total: v.names.length,
    }))
    .sort((a, b) => (prominence.get(b.sourceLabel) ?? 0) - (prominence.get(a.sourceLabel) ?? 0) || b.total - a.total || a.label.localeCompare(b.label))
    .slice(0, maxGroups)
    .map((g) => ({ ...g, names: g.names.slice(0, perGroup) }));
}

// --- Presentation-level milestone duplicate suppression (Section 22) --------

function tokenize(s: string): Set<string> {
  return new Set(
    s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 3),
  );
}
function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter += 1;
  return inter / (a.size + b.size - inter);
}
function entityOf(s: string): string {
  return /hospital/i.test(s) ? "hospital" : /clinic/i.test(s) ? "clinic" : "other";
}
function eventTypeOf(s: string): string {
  if (/(establish|found|foundation|inaugurat)/i.test(s)) return "founding";
  if (/expand/i.test(s)) return "expansion";
  if (/(building|construct)/i.test(s)) return "building";
  return "other";
}

/**
 * Suppress obvious duplicate timeline events at PRESENTATION time only (the
 * normalized model is untouched). Two events are equivalent when same year +
 * same entity + same event type + strong textual overlap. Uncertain ⇒ keep both.
 */
export function dedupeMilestonesForDisplay(milestones: Milestone[]): {
  kept: Milestone[];
  suppressed: Milestone[];
} {
  const kept: Milestone[] = [];
  const suppressed: Milestone[] = [];
  for (const m of milestones) {
    const dup = kept.find(
      (k) =>
        k.date.year === m.date.year &&
        entityOf(k.label) === entityOf(m.label) &&
        eventTypeOf(k.label) === eventTypeOf(m.label) &&
        jaccard(tokenize(k.label), tokenize(m.label)) > 0.45,
    );
    if (dup) suppressed.push(m);
    else kept.push(m);
  }
  return { kept, suppressed };
}

/** Restrained, non-numeric trust capabilities from safe facts only. */
export function selectTrustSignals(model: NormalizedHospital): string[] {
  const out: string[] = [];
  if (model.established.value) out.push(`Established ${model.established.value}`);
  if (model.specialties.length >= 8) out.push("Multispecialty Care");
  if (model.narrative.founder) out.push("Founder-led");
  return out;
}
