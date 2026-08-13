import { writeFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { buildNormalizedHospitalForLead } from "@/lib/normalize/integration";
import { parseNormalizedHospital } from "@/lib/normalize/model";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

const RUN = process.env.RUN_LIVE === "1";
const GANGA = "fa98583a-9cb4-4ba7-bbe6-139e366c38a8";

describe.skipIf(!RUN)("LIVE integration — Ganga from the real database", () => {
  it("builds a schema-valid live model and dumps a checkpoint summary", async () => {
    const supabase = createSupabaseServiceClient();
    const { model, heroRanking, eligibility, warnings } = await buildNormalizedHospitalForLead(supabase, GANGA);
    expect(() => parseNormalizedHospital(model)).not.toThrow();

    const byApproval = (s: string) => model.assets.filter((a) => a.approval_state === s).length;
    const byClass = (c: string) => model.assets.filter((a) => a.classification === c).length;
    const byRel = (r: number) => model.facilities.filter((f) => f.patient_relevance === r).length;
    const capSrc = (s: string) => model.facilities.filter((f) => f.caption_source === s).length;
    const res = (s: string) => model.people.doctors.filter((d) => d.resolution.state === s).length;

    const summary = {
      coverage: model.coverage,
      status: model.status,
      name: model.hospitalName?.value,
      established: model.established,
      emergency: model.emergency,
      appointment: model.appointment,
      phones: model.contact.phones.map((p) => p.value),
      emails: model.contact.emails.map((e) => e.value),
      address: model.location.address?.value,
      people: {
        doctors: model.people.doctors.length,
        admins: model.people.administrators.length,
        confident: res("confident"),
        ambiguous: res("ambiguous"),
        unresolved: res("unresolved"),
      },
      specialties: {
        total: model.specialties.length,
        known: model.specialties.filter((s) => s.known).length,
        unknown: model.specialties.filter((s) => !s.known).length,
      },
      facilities: {
        total: model.facilities.length,
        rel3: byRel(3), rel2: byRel(2), rel1: byRel(1), rel0: byRel(0),
        cap: { figcaption: capSrc("figcaption"), heading: capSrc("heading"), alt: capSrc("alt"), title: capSrc("title"), filename: capSrc("filename"), none: capSrc("none") },
      },
      assets: {
        total: model.assets.length,
        DISCOVERED: byApproval("DISCOVERED"), AUTO_APPROVED: byApproval("AUTO_APPROVED"),
        REVIEW_REQUIRED: byApproval("REVIEW_REQUIRED"), HUMAN_APPROVED: byApproval("HUMAN_APPROVED"), REJECTED: byApproval("REJECTED"),
        cls: { LOGO: byClass("LOGO"), EXTERIOR: byClass("EXTERIOR"), INTERIOR: byClass("INTERIOR"), FACILITY: byClass("FACILITY"), EQUIPMENT: byClass("EQUIPMENT"), PORTRAIT: byClass("PORTRAIT"), INSURER_MARK: byClass("INSURER_MARK"), RENDER: byClass("RENDER"), OTHER: byClass("OTHER") },
      },
      insurers: { total: model.insurers.length, confirmed: model.insurers.filter((i) => i.human_confirmed).length },
      accreditations: model.accreditations.map((a) => ({ body: a.body, status: a.status, raw: a.rawText.slice(0, 80), ev: a.evidence[0] })),
      milestones: model.narrative.milestones.map((m) => ({ year: m.date.year, month: m.date.month, label: m.label.slice(0, 70), src: m.evidence[0]?.sourceUrl, excerpt: m.evidence[0]?.excerpt?.slice(0, 80), tier: m.evidence[0]?.sourceTier })),
      founder: model.narrative.founder?.name,
      positioning: { count: model.positioningClaims.length, examples: model.positioningClaims.slice(0, 4).map((p) => p.text) },
      heroRanking: heroRanking.map((h) => ({
        rank: h.rank, id: h.asset.asset_id, url: h.asset.original_url, src: h.asset.source_page_url,
        cls: h.asset.classification, dim: `${h.asset.width}x${h.asset.height}`, aspect: h.asset.aspect,
        og: h.asset.og_declared, photo: h.asset.is_photograph, crowding: h.asset.crowding,
        approval: h.asset.approval_state, publicEligible: h.publicEligible, score: h.score.total, components: h.score.components,
      })),
      eligibility,
      warnings,
      provenance: {
        doctor: model.people.doctors[0] ? { name: model.people.doctors[0].displayName, ev: model.people.doctors[0].evidence[0] } : null,
        specialty: model.specialties[0] ? { label: model.specialties[0].display_label, ev: model.specialties[0].evidence[0] } : null,
        facility: model.facilities[0] ? { label: model.facilities[0].display_label, ev: model.facilities[0].evidence[0] } : null,
        emergency: model.emergency.evidence[0],
        appointment: model.appointment.evidence[0],
        asset: heroRanking[0] ? { url: heroRanking[0].asset.original_url, ev: heroRanking[0].asset.evidence[0] } : null,
      },
      tier4TextualFacts: [
        ...model.people.doctors, ...model.specialties, ...model.facilities, ...model.accreditations,
        ...model.insurers, ...model.narrative.about, ...model.narrative.milestones, ...model.positioningClaims,
      ].flatMap((x) => x.evidence).filter((e) => e.sourceTier === 4).length,
    };
    if (process.env.SP) writeFileSync(`${process.env.SP}/live-summary.json`, JSON.stringify(summary, null, 2));
    console.log("LIVE status=", summary.status, "doctors=", summary.people.doctors, "assets=", summary.assets.total, "tier4=", summary.tier4TextualFacts);
    expect(summary.tier4TextualFacts).toBe(0);
  }, 60_000);
});
