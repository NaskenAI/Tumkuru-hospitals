/* eslint-disable @next/next/no-img-element */
import {
  CalendarDays,
  Mail,
  MapPin,
  Navigation,
  Phone,
  Siren,
  Stethoscope,
} from "lucide-react";

import { isPubliclyEligible } from "@/lib/normalize/assets";
import type { NormalizedAsset, NormalizedHospital } from "@/lib/normalize/model";
import {
  dedupeMilestonesForDisplay,
  selectDoctorGroups,
  selectFeaturedFacilities,
  selectFeaturedSpecialties,
  selectTrustSignals,
} from "@/lib/hospital-v1/select";
import { hospitalMeta, warnMissing, type HospitalV1Meta } from "@/lib/hospital-v1/metadata";
import { t } from "@/lib/hospital-v1/strings";
import {
  ArrowLink,
  BRAND,
  Container,
  PrimaryButton,
  SecondaryButton,
  SectionHeading,
  assetUrl,
  hospitalActions,
} from "@/components/hospital-v1/ui";

type P = { puck: { metadata?: Record<string, unknown> }; [k: string]: unknown };

function useMeta(puck: P["puck"]): HospitalV1Meta | null {
  return hospitalMeta(puck);
}

function publicAsset(model: NormalizedHospital, id: string | null | undefined): NormalizedAsset | null {
  if (!id) return null;
  const a = model.assets.find((x) => x.asset_id === id);
  if (!a || !isPubliclyEligible(a.approval_state)) {
    if (id) warnMissing(id, "asset");
    return null;
  }
  return a;
}

function hospitalName(model: NormalizedHospital): string {
  return model.hospitalName?.value ?? "Hospital";
}

// ---------------------------------------------------------------------------
// Navbar
// ---------------------------------------------------------------------------
export function HospitalNavbar({ puck }: P) {
  const m = useMeta(puck);
  if (!m) return null;
  const { model, lang, slug } = m;
  const a = hospitalActions(model);
  const logo = model.assets.find((x) => x.classification === "LOGO" && isPubliclyEligible(x.approval_state));

  const links = [
    model.specialties.length > 0 && { href: "#specialties", label: t("nav_specialties", lang) },
    model.people.doctors.length > 0 && { href: "#doctors", label: t("nav_doctors", lang) },
    model.facilities.length > 0 && { href: "#facilities", label: t("nav_facilities", lang) },
    model.narrative.about.length > 0 && { href: "#about", label: t("nav_about", lang) },
    { href: "#contact", label: t("nav_contact", lang) },
  ].filter(Boolean) as { href: string; label: string }[];

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <Container className="flex h-16 items-center justify-between gap-4">
        <a href="#top" className="flex items-center gap-2.5 shrink-0">
          {logo ? (
            <img src={assetUrl(logo.asset_id)} alt={hospitalName(model)} className="h-9 w-auto" loading="eager" decoding="async" />
          ) : (
            <span className="font-serif text-lg font-semibold text-slate-900">{hospitalName(model)}</span>
          )}
        </a>
        <nav aria-label="Primary" className="hidden items-center gap-7 lg:flex">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="text-sm font-medium text-slate-600 hover:text-slate-900">
              {l.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <span className="hidden items-center gap-1 text-xs font-semibold text-slate-500 sm:flex">
            <a href="?lang=en" className={lang === "en" ? "text-slate-900" : "hover:text-slate-800"}>EN</a>
            <span aria-hidden="true">·</span>
            <a href="?lang=kn" className={lang === "kn" ? "text-slate-900" : "hover:text-slate-800"}>ಕನ್ನಡ</a>
          </span>
          {a.callHref && (
            <a href={a.callHref} data-analytics-event="call_clicked" data-preview-slug={slug}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-800 hover:border-slate-400">
              <Phone size={15} aria-hidden="true" /><span className="hidden sm:inline">{t("call_hospital", lang)}</span>
            </a>
          )}
          {a.bookHref && (
            <PrimaryButton href={a.bookHref} event="contact_clicked" slug={slug} external className="hidden h-9 px-4 sm:inline-flex">
              {t("book_appointment", lang)}
            </PrimaryButton>
          )}
        </div>
      </Container>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Hero — image | no-image
// ---------------------------------------------------------------------------
export function HospitalHero({ puck, variant = "no-image", heroAssetId = null }: P & { variant?: string; heroAssetId?: string | null }) {
  const m = useMeta(puck);
  if (!m) return null;
  const { model, lang, slug } = m;
  const a = hospitalActions(model);
  const hero = variant === "image" ? publicAsset(model, heroAssetId) : null;
  const descriptorParts = [model.location.city?.value, model.established.value ? `Established ${model.established.value}` : null].filter(Boolean);
  const descriptor = descriptorParts.join(" · ");

  const ctas = (
    <div className="mt-8 flex flex-wrap items-center gap-3">
      {a.bookHref ? (
        <PrimaryButton href={a.bookHref} event="contact_clicked" slug={slug} external>{t("book_appointment", lang)}</PrimaryButton>
      ) : a.findDoctorHref ? (
        <PrimaryButton href={a.findDoctorHref}>{t("find_a_doctor", lang)}</PrimaryButton>
      ) : null}
      {a.callHref && <SecondaryButton href={a.callHref} event="call_clicked" slug={slug}>{t("call_hospital", lang)}</SecondaryButton>}
      {a.directionsHref && (
        <a href={a.directionsHref} target="_blank" rel="noopener noreferrer" data-analytics-event="directions_clicked" data-preview-slug={slug}
          className="inline-flex h-11 items-center gap-1.5 px-2 text-sm font-semibold text-slate-600 hover:text-slate-900">
          <Navigation size={16} aria-hidden="true" />{t("get_directions", lang)}
        </a>
      )}
    </div>
  );

  if (hero) {
    return (
      <section id="top" className="relative isolate overflow-hidden bg-slate-900">
        <img src={assetUrl(hero.asset_id)} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover" loading="eager" decoding="async" />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/85 via-slate-950/60 to-slate-950/20" />
        <Container className="relative py-24 sm:py-32">
          <div className="max-w-2xl text-white">
            {descriptor && <p className="text-sm font-medium uppercase tracking-[0.16em] text-white/70">{descriptor}</p>}
            <h1 className="mt-3 font-serif text-4xl font-semibold leading-[1.08] tracking-tight sm:text-6xl">{hospitalName(model)}</h1>
            {ctas}
          </div>
        </Container>
      </section>
    );
  }

  return (
    <section id="top" className="border-b border-slate-200 bg-slate-50">
      <Container className="py-20 sm:py-28">
        <div className="max-w-3xl">
          {descriptor && <p className="text-sm font-medium uppercase tracking-[0.16em]" style={{ color: BRAND }}>{descriptor}</p>}
          <h1 className="mt-3 font-serif text-4xl font-semibold leading-[1.08] tracking-tight text-slate-900 sm:text-6xl">{hospitalName(model)}</h1>
          {ctas}
        </div>
      </Container>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Quick patient actions (slim utility strip)
// ---------------------------------------------------------------------------
export function QuickPatientActions({ puck }: P) {
  const m = useMeta(puck);
  if (!m) return null;
  const { model, lang, slug, eligibility } = m;
  const a = hospitalActions(model);
  const items = [
    a.findDoctorHref && { icon: Stethoscope, label: t("find_a_doctor", lang), href: a.findDoctorHref, event: undefined, ext: false },
    a.bookHref && { icon: CalendarDays, label: t("book_appointment", lang), href: a.bookHref, event: "contact_clicked", ext: true },
    eligibility.EmergencyBar?.eligible && a.callHref && { icon: Siren, label: t("emergency", lang), href: a.callHref, event: "call_clicked", ext: false },
    a.directionsHref && { icon: Navigation, label: t("get_directions", lang), href: a.directionsHref, event: "directions_clicked", ext: true },
  ].filter(Boolean) as { icon: typeof Phone; label: string; href: string; event?: string; ext: boolean }[];
  if (items.length < 2) return null;

  return (
    <section className="border-b border-slate-200 bg-white">
      <Container>
        <ul className="grid grid-cols-2 divide-slate-200 sm:flex sm:divide-x">
          {items.map((it) => {
            const Icon = it.icon;
            return (
              <li key={it.label} className="flex-1">
                <a href={it.href} {...(it.ext ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  data-analytics-event={it.event} data-preview-slug={slug}
                  className="flex items-center justify-center gap-2 px-4 py-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                  <Icon size={17} aria-hidden="true" style={{ color: BRAND }} />{it.label}
                </a>
              </li>
            );
          })}
        </ul>
      </Container>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Emergency bar (only when eligible; neutral wording unless 24/7 supported)
// ---------------------------------------------------------------------------
export function EmergencyBar({ puck }: P) {
  const m = useMeta(puck);
  if (!m || !m.eligibility.EmergencyBar?.eligible) return null;
  const { model, lang, slug } = m;
  const a = hospitalActions(model);
  const is247 = /24\s*[x/×]?\s*7|24\/7|round[- ]the[- ]clock/i.test(model.emergency.text ?? "");
  const label = `${is247 ? "24/7 " : ""}${t("emergency_services", lang)}`;
  return (
    <section aria-label={t("emergency_services", lang)} className="bg-red-700 text-white">
      <Container className="flex flex-wrap items-center justify-between gap-3 py-3">
        <p className="flex items-center gap-2 text-sm font-semibold"><Siren size={18} aria-hidden="true" />{label}</p>
        {a.callHref && a.phoneDisplay && (
          <a href={a.callHref} data-analytics-event="call_clicked" data-preview-slug={slug}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-white px-3.5 text-sm font-bold text-red-700">
            <Phone size={15} aria-hidden="true" />{a.phoneDisplay}
          </a>
        )}
      </Container>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Trust signals (restrained capability chips — no fabricated numbers)
// ---------------------------------------------------------------------------
export function TrustSignals({ puck }: P) {
  const m = useMeta(puck);
  if (!m) return null;
  const signals = selectTrustSignals(m.model);
  if (signals.length < 2) return null;
  return (
    <section className="border-b border-slate-200 bg-white">
      <Container className="flex flex-wrap items-center gap-x-8 gap-y-2 py-4">
        {signals.map((s) => (
          <span key={s} className="text-sm font-medium text-slate-600">{s}</span>
        ))}
      </Container>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Specialties (editorial numbered grid, no fabricated descriptions)
// ---------------------------------------------------------------------------
export function SpecialtiesSection({ puck, specialtyLabels = [] }: P & { specialtyLabels?: string[] }) {
  const m = useMeta(puck);
  if (!m) return null;
  const { model, lang } = m;
  const bySource = new Map(model.specialties.map((s) => [s.source_label, s]));
  let chosen = (specialtyLabels.map((l) => bySource.get(l)).filter(Boolean) as typeof model.specialties);
  if (chosen.length === 0) chosen = selectFeaturedSpecialties(model, 6);
  if (chosen.length === 0) return null;
  const total = model.specialties.length;

  return (
    <section id="specialties" className="scroll-mt-20 bg-white py-16 sm:py-20">
      <Container>
        <SectionHeading eyebrow={t("our_specialties", lang)} title={t("our_specialties", lang)} />
        <ol className="mt-10 grid gap-x-10 gap-y-6 border-t border-slate-200 pt-8 sm:grid-cols-2 lg:grid-cols-3">
          {chosen.map((s, i) => (
            <li key={s.source_label} className="flex items-baseline gap-4 border-b border-slate-100 pb-4">
              <span className="font-serif text-sm tabular-nums text-slate-400">{String(i + 1).padStart(2, "0")}</span>
              <span className="text-lg font-medium text-slate-900">{s.display_label}</span>
            </li>
          ))}
        </ol>
        {total > chosen.length && (
          <div className="mt-8"><ArrowLink href="#doctors">{t("view_all_specialties", lang)}</ArrowLink></div>
        )}
      </Container>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Facilities (text-first — imagery only when safely attributable; here none)
// ---------------------------------------------------------------------------
export function FacilitiesSection({ puck, facilityRefs = [] }: P & { facilityRefs?: string[] }) {
  const m = useMeta(puck);
  if (!m) return null;
  const { model, lang } = m;
  const byId = new Map(model.facilities.map((f) => [f.facility_id, f]));
  let chosen = facilityRefs
    .map((r) => {
      const f = byId.get(r);
      if (!f) warnMissing(r, "facility");
      return f;
    })
    .filter(Boolean) as typeof model.facilities;
  if (chosen.length === 0) chosen = selectFeaturedFacilities(model, 6);
  if (chosen.length === 0) return null;

  return (
    <section id="facilities" className="scroll-mt-20 bg-slate-50 py-16 sm:py-20">
      <Container>
        <SectionHeading eyebrow={t("facilities_services", lang)} title={t("facilities_services", lang)} />
        <div className="mt-10 grid gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 sm:grid-cols-2 lg:grid-cols-3">
          {chosen.map((f) => (
            <div key={f.facility_id} className="flex items-center gap-3 bg-white px-5 py-5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md" style={{ backgroundColor: "#e6f0f2", color: BRAND }}>
                <Stethoscope size={17} aria-hidden="true" />
              </span>
              <span className="font-medium text-slate-900">{f.display_label}</span>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Doctors by group (editorial directory, names only — no fake portraits)
// ---------------------------------------------------------------------------
export function DoctorsByGroup({ puck, groupLabels = [] }: P & { groupLabels?: string[] }) {
  const m = useMeta(puck);
  if (!m) return null;
  const { model, lang } = m;
  const all = selectDoctorGroups(model, 8, 8);
  const groups = groupLabels.length ? groupLabels.map((g) => all.find((x) => x.sourceLabel === g)).filter(Boolean) as typeof all : all.slice(0, 6);
  if (groups.length === 0) return null;
  const totalDoctors = model.people.doctors.length;

  return (
    <section id="doctors" className="scroll-mt-20 bg-white py-16 sm:py-20">
      <Container>
        <SectionHeading eyebrow={t("our_doctors", lang)} title={t("our_doctors", lang)} />
        <div className="mt-10 grid gap-x-12 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => (
            <div key={g.sourceLabel}>
              <h3 className="border-b border-slate-200 pb-2 text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: BRAND }}>
                {g.label}
              </h3>
              <ul className="mt-3 space-y-1.5">
                {g.names.map((n) => (
                  <li key={n} className="text-[15px] text-slate-800">{n}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        {totalDoctors > groups.reduce((a, g) => a + g.names.length, 0) && (
          <div className="mt-10"><ArrowLink href="#contact">{t("view_all_doctors", lang)}</ArrowLink></div>
        )}
      </Container>
    </section>
  );
}

// ---------------------------------------------------------------------------
// About
// ---------------------------------------------------------------------------
export function AboutHospital({ puck, aboutImageAssetId = null }: P & { aboutImageAssetId?: string | null }) {
  const m = useMeta(puck);
  if (!m) return null;
  const { model, lang } = m;
  const paras = model.narrative.about.slice(0, 2).map((p) => p.text);
  if (paras.length === 0) return null;
  const img = publicAsset(model, aboutImageAssetId);

  return (
    <section id="about" className="scroll-mt-20 bg-slate-50 py-16 sm:py-20">
      <Container className={img ? "grid items-center gap-10 lg:grid-cols-2" : "max-w-3xl"}>
        {img && (
          <img src={assetUrl(img.asset_id)} alt="" aria-hidden="true" loading="lazy" decoding="async"
            className="order-last aspect-[4/3] w-full rounded-xl object-cover shadow-sm lg:order-first" />
        )}
        <div>
          <SectionHeading eyebrow={t("about_the_hospital", lang)} title={`${t("about_the_hospital", lang)}`} />
          <div className="mt-5 space-y-4 text-[17px] leading-relaxed text-slate-700">
            {paras.map((p, i) => <p key={i}>{p}</p>)}
          </div>
        </div>
      </Container>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Founder (text only unless a HUMAN_APPROVED portrait exists — it never is here)
// ---------------------------------------------------------------------------
export function FounderProfile({ puck }: P) {
  const m = useMeta(puck);
  if (!m || !m.eligibility.FounderProfile?.eligible || !m.model.narrative.founder) return null;
  const { model, lang } = m;
  const founder = model.narrative.founder!;
  return (
    <section className="bg-white py-14">
      <Container className="max-w-3xl rounded-xl border border-slate-200 bg-slate-50 p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: BRAND }}>{t("founder", lang)}</p>
        <p className="mt-3 font-serif text-2xl font-semibold text-slate-900">{founder.name}</p>
      </Container>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Milestones (presentation-level duplicate suppression)
// ---------------------------------------------------------------------------
function cleanMilestone(label: string): string {
  const s = label
    .replace(/^\s*\d{4,8}\s*/, "")
    .replace(/^(short introduction|our highlights|apply for accreditation and recognition)\s*/i, "")
    .trim();
  const words = s.split(/\s+/);
  return words.length > 16 ? words.slice(0, 16).join(" ") + "…" : s;
}

export function MilestoneTimeline({ puck }: P) {
  const m = useMeta(puck);
  if (!m || !m.eligibility.MilestoneTimeline?.eligible) return null;
  const { model, lang } = m;
  const { kept, suppressed } = dedupeMilestonesForDisplay(model.narrative.milestones);
  if (suppressed.length && process.env.NODE_ENV !== "production") {
    console.warn(`[hospital-v1] milestone timeline suppressed ${suppressed.length} duplicate event(s)`);
  }
  const events = [...kept].filter((e) => e.date.year).sort((a, b) => (a.date.year ?? 0) - (b.date.year ?? 0));
  if (events.length < 2) return null;

  return (
    <section className="bg-slate-50 py-16 sm:py-20">
      <Container className="max-w-3xl">
        <SectionHeading eyebrow={t("our_journey", lang)} title={t("our_journey", lang)} />
        <ol className="mt-10 border-l border-slate-300">
          {events.map((e, i) => (
            <li key={i} className="relative pb-8 pl-8 last:pb-0">
              <span className="absolute -left-[7px] top-1 size-3.5 rounded-full border-2 border-white" style={{ backgroundColor: BRAND }} />
              <p className="font-serif text-xl font-semibold text-slate-900">{e.date.year}</p>
              <p className="mt-1 text-slate-700">{cleanMilestone(e.label)}</p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Accreditation strip — ONLY HELD (never APPLIED)
// ---------------------------------------------------------------------------
export function AccreditationStrip({ puck }: P) {
  const m = useMeta(puck);
  if (!m || !m.eligibility.AccreditationStrip?.eligible) return null;
  const held = m.model.accreditations.filter((a) => a.status === "HELD");
  if (held.length === 0) return null;
  return (
    <section className="border-y border-slate-200 bg-white py-8">
      <Container className="flex flex-wrap items-center gap-x-8 gap-y-3">
        {held.map((a, i) => (
          <span key={i} className="text-sm font-semibold text-slate-700">{a.body} Accredited</span>
        ))}
      </Container>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Insurance panel — ONLY human-confirmed insurers
// ---------------------------------------------------------------------------
export function InsurancePanel({ puck }: P) {
  const m = useMeta(puck);
  if (!m || !m.eligibility.InsurancePanel?.eligible) return null;
  const confirmed = m.model.insurers.filter((i) => i.human_confirmed);
  if (confirmed.length === 0) return null;
  return (
    <section className="bg-white py-14">
      <Container>
        <SectionHeading title="Insurance & Cashless" />
        <div className="mt-6 flex flex-wrap gap-2">
          {confirmed.map((i) => (
            <span key={i.name} className="rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-700">{i.name}</span>
          ))}
        </div>
      </Container>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Patient information (quiet late-page quick links; self-hides if sparse)
// ---------------------------------------------------------------------------
export function PatientInformation({ puck }: P) {
  const m = useMeta(puck);
  if (!m) return null;
  const { model, lang, slug } = m;
  const a = hospitalActions(model);
  const items = [
    a.bookHref && { label: t("book_appointment", lang), href: a.bookHref, ext: true, event: "contact_clicked" },
    m.eligibility.EmergencyBar?.eligible && a.callHref && { label: t("emergency_services", lang), href: a.callHref, ext: false, event: "call_clicked" },
    a.findDoctorHref && { label: t("find_a_doctor", lang), href: a.findDoctorHref, ext: false, event: undefined },
    a.directionsHref && { label: t("get_directions", lang), href: a.directionsHref, ext: true, event: "directions_clicked" },
  ].filter(Boolean) as { label: string; href: string; ext: boolean; event?: string }[];
  if (items.length < 3) return null;

  return (
    <section className="bg-white py-14">
      <Container>
        <SectionHeading eyebrow={t("for_patients", lang)} title={t("for_patients", lang)} />
        <div className="mt-8 grid gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((it) => (
            <a key={it.label} href={it.href} {...(it.ext ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              data-analytics-event={it.event} data-preview-slug={slug}
              className="bg-white px-5 py-6 text-sm font-semibold text-slate-800 hover:bg-slate-50">
              {it.label} <span aria-hidden="true" style={{ color: BRAND }}>→</span>
            </a>
          ))}
        </div>
      </Container>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Appointment CTA
// ---------------------------------------------------------------------------
export function AppointmentCTA({ puck }: P) {
  const m = useMeta(puck);
  if (!m || !m.eligibility.AppointmentCTA?.eligible) return null;
  const { model, lang, slug } = m;
  const a = hospitalActions(model);
  if (!a.bookHref) return null;
  return (
    <section className="py-16 text-white" style={{ backgroundColor: BRAND }}>
      <Container className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
        <h2 className="font-serif text-3xl font-semibold">{t("need_appointment", lang)}</h2>
        <div className="flex flex-wrap gap-3">
          <a href={a.bookHref} target="_blank" rel="noopener noreferrer" data-analytics-event="contact_clicked" data-preview-slug={slug}
            className="inline-flex h-11 items-center rounded-md bg-white px-6 text-sm font-semibold" style={{ color: BRAND }}>
            {t("book_appointment", lang)}
          </a>
          {a.callHref && (
            <a href={a.callHref} data-analytics-event="call_clicked" data-preview-slug={slug}
              className="inline-flex h-11 items-center rounded-md border border-white/40 px-6 text-sm font-semibold text-white hover:bg-white/10">
              {t("call_hospital", lang)}
            </a>
          )}
        </div>
      </Container>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Contact / location (address panel; no invented map)
// ---------------------------------------------------------------------------
export function ContactLocation({ puck }: P) {
  const m = useMeta(puck);
  if (!m) return null;
  const { model, lang, slug } = m;
  const a = hospitalActions(model);
  const address = model.location.address?.value;
  const email = model.contact.emails[0]?.value;

  return (
    <section id="contact" className="scroll-mt-20 bg-slate-50 py-16 sm:py-20">
      <Container>
        <SectionHeading eyebrow={t("visit_us", lang)} title={t("visit_us", lang)} />
        <div className="mt-10 grid gap-8 lg:grid-cols-2">
          <div className="flex min-h-56 flex-col justify-center rounded-xl border border-slate-200 p-8" style={{ backgroundColor: "#0e5a6b0d" }}>
            <p className="font-serif text-2xl font-semibold text-slate-900">{hospitalName(model)}</p>
            {address && <p className="mt-3 flex items-start gap-2 text-slate-700"><MapPin size={18} className="mt-0.5 shrink-0" style={{ color: BRAND }} aria-hidden="true" />{address}</p>}
          </div>
          <div className="space-y-4">
            {a.phoneDisplay && (
              <a href={a.callHref ?? "#"} data-analytics-event="call_clicked" data-preview-slug={slug} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4">
                <Phone size={18} style={{ color: BRAND }} aria-hidden="true" />
                <span><span className="block text-xs uppercase tracking-wide text-slate-400">{t("phone_label", lang)}</span><span className="font-medium text-slate-900">{a.phoneDisplay}</span></span>
              </a>
            )}
            {email && (
              <a href={`mailto:${email}`} data-analytics-event="contact_clicked" data-preview-slug={slug} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4">
                <Mail size={18} style={{ color: BRAND }} aria-hidden="true" />
                <span><span className="block text-xs uppercase tracking-wide text-slate-400">{t("email_label", lang)}</span><span className="font-medium text-slate-900">{email}</span></span>
              </a>
            )}
            <div className="flex flex-wrap gap-3 pt-1">
              {a.directionsHref && <SecondaryButton href={a.directionsHref} event="directions_clicked" slug={slug} external>{t("get_directions", lang)}</SecondaryButton>}
              {a.callHref && a.phoneDisplay && <PrimaryButton href={a.callHref} event="call_clicked" slug={slug}>{t("call_hospital", lang)}</PrimaryButton>}
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------
export function HospitalFooter({ puck }: P) {
  const m = useMeta(puck);
  if (!m) return null;
  const { model, lang } = m;
  const logo = model.assets.find((x) => x.classification === "LOGO" && isPubliclyEligible(x.approval_state));
  return (
    <footer className="border-t border-slate-200 bg-white py-12">
      <Container className="flex flex-col gap-6">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row">
          <div>
            {logo ? (
              <img src={assetUrl(logo.asset_id)} alt={hospitalName(model)} className="h-9 w-auto" loading="lazy" decoding="async" />
            ) : (
              <span className="font-serif text-lg font-semibold text-slate-900">{hospitalName(model)}</span>
            )}
            {model.location.address?.value && <p className="mt-3 max-w-xs text-sm text-slate-500">{model.location.address.value}</p>}
          </div>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600">
            {model.specialties.length > 0 && <a href="#specialties" className="hover:text-slate-900">{t("nav_specialties", lang)}</a>}
            {model.people.doctors.length > 0 && <a href="#doctors" className="hover:text-slate-900">{t("nav_doctors", lang)}</a>}
            {model.facilities.length > 0 && <a href="#facilities" className="hover:text-slate-900">{t("nav_facilities", lang)}</a>}
            <a href="#contact" className="hover:text-slate-900">{t("nav_contact", lang)}</a>
          </nav>
        </div>
        <p className="border-t border-slate-100 pt-6 text-xs text-slate-400">{t("unofficial_preview", lang)}</p>
      </Container>
    </footer>
  );
}
