import { describe, expect, it } from "vitest";

import { normalizeHospital } from "@/lib/normalize/normalize";
import { parseNormalizedHospital, type Evidence, type NormalizedHospital, type SourcePage } from "@/lib/normalize/model";
import { isPlaceholderText } from "@/lib/normalize/text";
import { loadAllGangaPages, loadGanga } from "@/lib/normalize/__fixtures__/ganga";

// Collect evidence attached to TEXTUAL entities (assets excluded — vision is
// allowed there, but never as the sole basis of a text fact).
function textualEvidence(m: NormalizedHospital): Evidence[] {
  const ev: Evidence[] = [];
  const push = (arr?: { evidence: Evidence[] }[]) => arr?.forEach((x) => ev.push(...x.evidence));
  push(m.people.doctors);
  push(m.people.administrators);
  push(m.specialties);
  push(m.facilities);
  push(m.accreditations);
  push(m.insurers);
  push(m.narrative.about);
  push(m.narrative.milestones);
  push(m.positioningClaims);
  ev.push(...m.contact.phones.flatMap((p) => p.evidence));
  if (m.narrative.founder) ev.push(...m.narrative.founder.evidence);
  if (m.hospitalName) ev.push(...m.hospitalName.evidence);
  return ev;
}

describe("Ganga end-to-end normalization", () => {
  const model = normalizeHospital({ pages: loadAllGangaPages() });

  it("produces a schema-valid, non-FAILED model with coverage", () => {
    expect(() => parseNormalizedHospital(model)).not.toThrow();
    expect(model.status).not.toBe("FAILED");
    expect(model.coverage.pagesCrawled).toBe(6);
    console.log(
      `GANGA model: status=${model.status} parsed=${model.coverage.pagesParsed}/${model.coverage.pagesCrawled} ` +
        `doctors=${model.people.doctors.length} admins=${model.people.administrators.length} ` +
        `specialties=${model.specialties.length} facilities=${model.facilities.length} ` +
        `insurers=${model.insurers.length} positioning=${model.positioningClaims.length} ` +
        `accreditations=${model.accreditations.length} unparsed=${model.coverage.unparsed.length}`,
    );
  });

  it("separates the administrator and keeps ambiguity visible", () => {
    expect(model.people.administrators.some((a) => /Prem Kishore/i.test(a.displayName))).toBe(true);
    expect(model.people.doctors.some((d) => /Prem Kishore/i.test(d.displayName))).toBe(false);
    expect(model.people.doctors.some((d) => d.resolution.state === "ambiguous")).toBe(true);
  });

  it("preserves the specialty typo in source, cleans display (F3)", () => {
    const jr = model.specialties.find((s) => s.source_label === "JOINT REPLACAMENT");
    expect(jr).toBeDefined();
    expect(jr!.display_label).toBe("Joint Replacement");
  });

  it("has clinical and infrastructure facilities with bound captions", () => {
    expect(model.facilities.some((f) => f.patient_relevance === 3)).toBe(true);
    expect(model.facilities.some((f) => f.patient_relevance === 0)).toBe(true);
  });

  it("keeps insurers unconfirmed and superlatives out of neutral fields", () => {
    expect(model.insurers.every((i) => !i.human_confirmed)).toBe(true);
    expect(model.positioningClaims.length).toBeGreaterThan(0);
  });

  it("F9 — placeholder text is detected and never enters narrative", () => {
    const deptText = loadGanga("departments").pageText;
    expect(isPlaceholderText(deptText)).toBe(true); // the fixture really contains it
    expect(model.narrative.about.every((a) => !isPlaceholderText(a.text))).toBe(true);
  });

  it("has NO tier-4 (vision-only) evidence backing any textual fact", () => {
    expect(textualEvidence(model).every((e) => e.sourceTier !== 4)).toBe(true);
  });
});

// --- Synthetic model-level fixtures (Section 29) ----------------------------

function teamHtml(title: string, groups: { name: string; docs: string[] }[]): string {
  const body = groups.map((g) => `<h2>${g.name}</h2><p>${g.docs.join(" ")}</p>`).join("");
  return `<!doctype html><html><head><title>${title}</title></head><body><div class="entry-content"><h2>DOCTORS</h2>${body}</div></body></html>`;
}
function homeHtml(opts: { title: string; extra?: string }): string {
  return `<!doctype html><html><head><title>${opts.title}</title></head><body><div class="entry-content"><h1>${opts.title}</h1><p>Address: 1 Main Road, Tumkur - 572101. Phone: +91 90000 12345.</p>${opts.extra ?? ""}</div></body></html>`;
}
function page(id: string, path: string, html: string, pageType?: string): SourcePage {
  return { id, url: `https://synth.example${path}`, tier: 2, pageType, html };
}
function grp(prefix: string): { name: string; docs: string[] } {
  return { name: `${prefix} SPECIALTY`, docs: [`Dr ${prefix} Alpha`, `Dr ${prefix} Beta`] };
}

describe("synthetic — rich hospital", () => {
  const groups = Array.from({ length: 20 }, (_, i) => grp(`S${i}`));
  const model = normalizeHospital({
    pages: [
      page("home", "/", homeHtml({ title: "Rich Multispecialty Hospital", extra: "<p>We offer 24x7 emergency services. NABH accredited hospital.</p>" }), "HOME"),
      page("team", "/our-team/", teamHtml("Rich Multispecialty Hospital", groups), "DOCTORS"),
    ],
  });
  it("normalizes ~40 doctors across ~20 specialties, emergency + accreditation", () => {
    expect(parseNormalizedHospital(model).status).not.toBe("FAILED");
    expect(model.people.doctors.length).toBeGreaterThanOrEqual(38);
    expect(model.specialties.length).toBeGreaterThanOrEqual(18);
    expect(model.emergency.available).toBe(true);
    expect(model.accreditations.some((a) => a.status === "HELD")).toBe(true);
  });
});

describe("synthetic — sparse hospital (no emergency/photos/accreditation)", () => {
  const model = normalizeHospital({
    pages: [
      page("home", "/", homeHtml({ title: "Sparse Clinic" }), "HOME"),
      page("team", "/our-team/", teamHtml("Sparse Clinic", [
        { name: "GENERAL MEDICINE", docs: ["Dr Anand Rao"] },
        { name: "PAEDIATRICS", docs: ["Dr Bina Shah"] },
        { name: "ENT", docs: ["Dr Chandra Nair"] },
      ]), "DOCTORS"),
    ],
  });
  it("makes no rich-hospital assumptions", () => {
    expect(parseNormalizedHospital(model).status).not.toBe("FAILED");
    expect(model.emergency.available).toBe("unknown");
    expect(model.accreditations).toHaveLength(0);
    expect(model.facilities).toHaveLength(0);
    expect(model.people.doctors.length).toBe(3);
  });
});

describe("synthetic — specialty (ortho-heavy) hospital", () => {
  const groups = Array.from({ length: 10 }, (_, i) => ({
    name: `ORTHO SUB ${i}`,
    docs: [`Dr Ortho A${i}`, `Dr Ortho B${i}`, `Dr Ortho C${i}`],
  }));
  const model = normalizeHospital({
    pages: [
      page("home", "/", homeHtml({ title: "Ortho Speciality Hospital" }), "HOME"),
      page("team", "/our-team/", teamHtml("Ortho Speciality Hospital", groups), "DOCTORS"),
      page("fac", "/facilities/", `<div class="entry-content"><h3>Operation Theatre</h3><figure><img src="/x/ot.jpg"></figure><h3>Generator</h3><figure><img src="/x/gen.jpg"></figure></div>`, "FACILITIES"),
    ],
  });
  it("handles a facility-heavy specialty hospital", () => {
    expect(model.people.doctors.length).toBeGreaterThanOrEqual(28);
    expect(model.specialties.length).toBeGreaterThanOrEqual(9);
    expect(model.facilities.length).toBeGreaterThanOrEqual(2);
  });
});

describe("hospital establishment vs predecessor clinic vs copyright", () => {
  const aboutPage = (body: string): SourcePage => ({
    id: "about", url: "https://h.example/about/", tier: 2, pageType: "ABOUT",
    html: `<html><head><title>H Hospital</title></head><body><div class="entry-content"><p>${body}</p></div></body></html>`,
  });

  it("copyright year never becomes an establishment date", () => {
    const m = normalizeHospital({ pages: [aboutPage("© 2017-26 H Hospital. All rights reserved.")] });
    expect(m.established.value).toBeNull();
  });

  it("predecessor clinic founding does not become hospital establishment", () => {
    const m = normalizeHospital({ pages: [aboutPage("The clinic was established in 2017 as a small facility.")] });
    expect(m.established.value).toBeNull();
    expect(m.established.entity).toBe("predecessor clinic");
  });

  it("uses the hospital establishment date when stated", () => {
    const m = normalizeHospital({
      pages: [aboutPage("The clinic was established in 2017. The hospital was established in February 2024.")],
    });
    expect(m.established.entity).toBe("hospital");
    expect(m.established.value).toBe(2024);
    expect(m.established.precision).toBe("month");
  });
});

describe("normalization failure contract", () => {
  it("records an unparsable page in coverage.unparsed and stays PARTIAL", () => {
    const model = normalizeHospital({
      pages: [
        page("home", "/", homeHtml({ title: "Half Broken Hospital" }), "HOME"),
        page("team", "/our-team/", teamHtml("Half Broken Hospital", [
          { name: "CARDIOLOGY", docs: ["Dr Real One", "Dr Real Two"] },
          { name: "NEUROLOGY", docs: ["Dr Real Three"] },
        ]), "DOCTORS"),
        page("broken", "/broken/", "   ", "OTHER"),
      ],
      pagesDiscovered: 4,
    });
    expect(model.coverage.unparsed.some((u) => u.url.endsWith("/broken/"))).toBe(true);
    expect(model.coverage.pagesParsed).toBe(2);
    expect(model.coverage.pagesDiscovered).toBe(4);
    expect(model.status).toBe("PARTIAL");
    // the rest of the model is preserved
    expect(model.people.doctors.length).toBe(3);
  });
});
