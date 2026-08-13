import {
  Activity,
  Building2,
  Clock,
  Mail,
  Phone,
  Shield,
  ShieldPlus,
  Stethoscope,
  User,
} from "lucide-react";

import { availableActions } from "@/lib/puck/actions";
import { isHospitalAccreditation } from "@/lib/puck/accreditation";
import { hospitalFromPuck, initials } from "@/lib/puck/metadata";
import { ActionButtons, Container, SectionHeading } from "@/components/puck/ui";

type SectionProps = {
  puck: { metadata?: Record<string, unknown> };
  variant?: string;
};

// ---------------------------------------------------------------------------
// Navbar
// ---------------------------------------------------------------------------

export function HospitalNavbar({ puck }: SectionProps) {
  const h = hospitalFromPuck(puck);
  if (!h) return null;
  const { content, slug } = h;
  const actions = availableActions(content);
  const call = actions.find((a) => a.kind === "call");

  const links: Array<{ href: string; label: string }> = [];
  if (content.specialties?.length) links.push({ href: "#specialties", label: "Specialties" });
  if (content.doctors?.length) links.push({ href: "#doctors", label: "Doctors" });
  if (content.about?.length) links.push({ href: "#about", label: "About" });
  links.push({ href: "#contact", label: "Contact" });

  return (
    <nav className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
      <Container className="flex h-16 items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-teal-700 text-white">
            <ShieldPlus size={18} aria-hidden="true" />
          </span>
          <span className="text-base font-bold tracking-tight text-slate-900">
            {content.hospital_name}
          </span>
        </div>
        <div className="hidden items-center gap-6 md:flex">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="text-sm font-medium text-slate-600 hover:text-teal-700">
              {l.label}
            </a>
          ))}
        </div>
        {call && (
          <a
            href={call.href}
            data-analytics-event="call_clicked"
            data-preview-slug={slug}
            className="inline-flex h-9 items-center gap-2 rounded-full bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800"
          >
            <Phone size={15} aria-hidden="true" />
            <span className="hidden sm:inline">{content.contact.phone}</span>
            <span className="sm:hidden">Call</span>
          </a>
        )}
      </Container>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Hero — variants: split | image-overlay | minimal
// ---------------------------------------------------------------------------

export function HospitalHero({ puck, variant = "split" }: SectionProps) {
  const h = hospitalFromPuck(puck);
  if (!h) return null;
  const { content, slug } = h;
  const actions = availableActions(content);

  const heading = (
    <>
      <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-slate-950 sm:text-5xl">
        {content.hospital_name}
      </h1>
      <p className="mt-4 max-w-xl text-lg text-slate-600">{content.tagline.text}</p>
      <div className="mt-7">
        <ActionButtons actions={actions} slug={slug} size="lg" />
      </div>
    </>
  );

  // A designed brand panel — NOT a photograph. No fabricated imagery.
  const brandPanel = (
    <div className="relative flex min-h-64 items-center justify-center overflow-hidden rounded-3xl bg-gradient-to-br from-teal-600 to-teal-900 p-8">
      <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_20%_20%,white_0,transparent_40%)]" />
      <ShieldPlus className="text-white/90" size={96} aria-hidden="true" strokeWidth={1.2} />
    </div>
  );

  if (variant === "minimal") {
    return (
      <header className="border-b border-slate-100 bg-white py-16 text-center sm:py-24">
        <Container>
          <div className="mx-auto max-w-2xl">
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-950 sm:text-5xl">
              {content.hospital_name}
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-lg text-slate-600">{content.tagline.text}</p>
            <div className="mt-7 flex justify-center">
              <ActionButtons actions={actions} slug={slug} size="lg" />
            </div>
          </div>
        </Container>
      </header>
    );
  }

  if (variant === "image-overlay") {
    return (
      <header className="relative overflow-hidden bg-gradient-to-br from-teal-700 to-teal-950 py-20 sm:py-28">
        <div className="absolute inset-0 opacity-15 [background:radial-gradient(circle_at_80%_10%,white_0,transparent_45%)]" />
        <Container className="relative">
          <div className="max-w-2xl text-white">
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl">
              {content.hospital_name}
            </h1>
            <p className="mt-4 max-w-xl text-lg text-teal-50/90">{content.tagline.text}</p>
            <div className="mt-8">
              <ActionButtons actions={actions} slug={slug} size="lg" />
            </div>
          </div>
        </Container>
      </header>
    );
  }

  // split (default)
  return (
    <header className="bg-white py-14 sm:py-20">
      <Container className="grid items-center gap-10 lg:grid-cols-2">
        <div>{heading}</div>
        <div>{brandPanel}</div>
      </Container>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Emergency strip
// ---------------------------------------------------------------------------

export function EmergencyStrip({ puck }: SectionProps) {
  const h = hospitalFromPuck(puck);
  if (!h) return null;
  const emergency = h.content.contact.emergency;
  if (!emergency) return null;
  const call = availableActions(h.content).find((a) => a.kind === "call");
  return (
    <div className="bg-rose-600 text-white">
      <Container className="flex flex-wrap items-center justify-between gap-3 py-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Activity size={18} aria-hidden="true" />
          {emergency}
        </div>
        {call && (
          <a
            href={call.href}
            data-analytics-event="call_clicked"
            data-preview-slug={h.slug}
            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white px-3 text-xs font-semibold text-rose-700"
          >
            <Phone size={13} aria-hidden="true" /> {h.content.contact.phone}
          </a>
        )}
      </Container>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quick actions
// ---------------------------------------------------------------------------

export function QuickActions({ puck }: SectionProps) {
  const h = hospitalFromPuck(puck);
  if (!h) return null;
  const actions = availableActions(h.content);
  if (actions.length === 0) return null;
  return (
    <section className="bg-slate-50 py-6">
      <Container>
        <div className="flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <ActionButtons actions={actions} slug={h.slug} />
        </div>
      </Container>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Specialty grid — variants: cards | compact | icon-grid
// ---------------------------------------------------------------------------

export function SpecialtyGrid({ puck, variant = "cards" }: SectionProps) {
  const h = hospitalFromPuck(puck);
  if (!h) return null;
  const specialties = h.content.specialties ?? [];
  if (specialties.length === 0) return null;

  return (
    <section id="specialties" className="bg-white py-14">
      <Container>
        <SectionHeading eyebrow="Areas of focus" title="Specialties & departments" />
        <div
          className={
            variant === "compact"
              ? "mt-8 flex flex-wrap gap-2"
              : variant === "icon-grid"
                ? "mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5"
                : "mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          }
        >
          {specialties.map((s, i) =>
            variant === "compact" ? (
              <span
                key={i}
                className="rounded-full border border-teal-100 bg-teal-50/70 px-4 py-2 text-sm font-medium text-teal-800"
              >
                {s.name}
              </span>
            ) : variant === "icon-grid" ? (
              <div
                key={i}
                className="flex flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm"
              >
                <span className="flex size-11 items-center justify-center rounded-full bg-teal-50 text-teal-700">
                  <Stethoscope size={20} aria-hidden="true" />
                </span>
                <span className="text-sm font-semibold text-slate-800">{s.name}</span>
              </div>
            ) : (
              <div
                key={i}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md"
              >
                <span className="flex size-10 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                  <Stethoscope size={18} aria-hidden="true" />
                </span>
                <h3 className="mt-3 font-semibold text-slate-900">{s.name}</h3>
                {s.description && (
                  <p className="mt-1 text-sm text-slate-600">{s.description}</p>
                )}
              </div>
            ),
          )}
        </div>
      </Container>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Doctor card + grid — variants: cards | compact-list | featured-first
// ---------------------------------------------------------------------------

export function DoctorCard({
  name,
  subtitle,
  featured = false,
}: {
  name: string;
  subtitle?: string;
  featured?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${
        featured ? "sm:p-7" : ""
      }`}
    >
      <div
        className={`flex items-center justify-center rounded-full bg-teal-50 font-bold text-teal-700 ${
          featured ? "size-16 text-xl" : "size-12"
        }`}
      >
        {initials(name) || <User size={20} aria-hidden="true" />}
      </div>
      <div>
        <h3 className={`font-semibold text-slate-900 ${featured ? "text-lg" : ""}`}>{name}</h3>
        {subtitle && <p className="text-sm text-teal-700">{subtitle}</p>}
      </div>
    </div>
  );
}

export function DoctorGrid({ puck, variant = "cards" }: SectionProps) {
  const h = hospitalFromPuck(puck);
  if (!h) return null;
  const doctors = h.content.doctors ?? [];
  if (doctors.length === 0) return null;
  const sub = (d: { specialty?: string; qualification?: string }) =>
    d.specialty || d.qualification || undefined;

  return (
    <section id="doctors" className="bg-slate-50 py-14">
      <Container>
        <SectionHeading eyebrow="Our team" title="Doctors & specialists" />
        {variant === "compact-list" ? (
          <ul className="mt-8 divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {doctors.map((d, i) => (
              <li key={i} className="flex items-center gap-4 p-4">
                <span className="flex size-9 items-center justify-center rounded-full bg-teal-50 text-sm font-bold text-teal-700">
                  {initials(d.name)}
                </span>
                <div>
                  <span className="font-medium text-slate-900">{d.name}</span>
                  {sub(d) && <span className="ml-2 text-sm text-slate-500">· {sub(d)}</span>}
                </div>
              </li>
            ))}
          </ul>
        ) : variant === "featured-first" ? (
          <div className="mt-8 space-y-4">
            <DoctorCard name={doctors[0].name} subtitle={sub(doctors[0])} featured />
            {doctors.length > 1 && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {doctors.slice(1).map((d, i) => (
                  <DoctorCard key={i} name={d.name} subtitle={sub(d)} />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {doctors.map((d, i) => (
              <DoctorCard key={i} name={d.name} subtitle={sub(d)} />
            ))}
          </div>
        )}
      </Container>
    </section>
  );
}

// ---------------------------------------------------------------------------
// About — variants: editorial | image-split | centered
// ---------------------------------------------------------------------------

export function AboutHospital({ puck, variant = "editorial" }: SectionProps) {
  const h = hospitalFromPuck(puck);
  if (!h) return null;
  const about = h.content.about ?? [];
  if (about.length === 0) return null;
  const paragraphs = about.map((p) => p.text);

  const body = (
    <div className="space-y-4 text-lg leading-relaxed text-slate-700">
      {paragraphs.map((t, i) => (
        <p key={i}>{t}</p>
      ))}
    </div>
  );

  if (variant === "centered") {
    return (
      <section id="about" className="bg-white py-14">
        <Container className="max-w-3xl text-center">
          <SectionHeading title={`About ${h.content.hospital_name}`} align="center" />
          <div className="mt-6">{body}</div>
        </Container>
      </section>
    );
  }

  if (variant === "image-split") {
    return (
      <section id="about" className="bg-white py-14">
        <Container className="grid items-center gap-10 lg:grid-cols-2">
          <div className="flex min-h-56 items-center justify-center rounded-3xl bg-gradient-to-br from-slate-100 to-teal-50 p-8">
            <Building2 className="text-teal-600/70" size={80} strokeWidth={1.2} aria-hidden="true" />
          </div>
          <div>
            <SectionHeading eyebrow="About" title={h.content.hospital_name} />
            <div className="mt-5">{body}</div>
          </div>
        </Container>
      </section>
    );
  }

  // editorial
  return (
    <section id="about" className="bg-white py-14">
      <Container className="max-w-3xl">
        <SectionHeading eyebrow="About" title={h.content.hospital_name} />
        <div className="mt-6">{body}</div>
      </Container>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Stats — derived counts only (never fabricated)
// ---------------------------------------------------------------------------

export function StatsSection({ puck }: SectionProps) {
  const h = hospitalFromPuck(puck);
  if (!h) return null;
  const { content } = h;
  const stats: Array<{ n: number; label: string }> = [];
  if (content.specialties?.length) stats.push({ n: content.specialties.length, label: "Specialties" });
  if (content.doctors?.length) stats.push({ n: content.doctors.length, label: "Doctors" });
  if (content.services?.length) stats.push({ n: content.services.length, label: "Services" });
  if (content.facilities?.length) stats.push({ n: content.facilities.length, label: "Facilities" });
  if (stats.length === 0) return null;

  return (
    <section className="bg-teal-900 py-10 text-white">
      <Container>
        <div className="grid grid-cols-2 gap-6 text-center sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label}>
              <div className="text-3xl font-extrabold">{s.n}</div>
              <div className="mt-1 text-sm text-teal-100/80">{s.label}</div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Insurance — only when insurance facts exist
// ---------------------------------------------------------------------------

export function InsuranceSection({ puck }: SectionProps) {
  const h = hospitalFromPuck(puck);
  if (!h) return null;
  const insurance = h.content.insurance ?? [];
  if (insurance.length === 0) return null;
  return (
    <section className="bg-white py-14">
      <Container>
        <SectionHeading eyebrow="Cashless & insurance" title="Accepted insurance" />
        <div className="mt-6 flex flex-wrap gap-2">
          {insurance.map((ins, i) => (
            <span key={i} className="rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-700">
              {ins.text}
            </span>
          ))}
        </div>
      </Container>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Accreditation — ONLY genuine hospital accreditations (never affiliations)
// ---------------------------------------------------------------------------

export function AccreditationSection({ puck }: SectionProps) {
  const h = hospitalFromPuck(puck);
  if (!h) return null;
  // Only genuine hospital accreditations — never a doctor's society membership,
  // even if it was mis-classified upstream as an ACCREDITATION fact.
  const accreditations = (h.content.accreditations ?? []).filter((a) =>
    isHospitalAccreditation(a.text),
  );
  if (accreditations.length === 0) return null;
  return (
    <section className="bg-slate-50 py-12">
      <Container>
        <SectionHeading eyebrow="Accreditation" title="Recognitions" />
        <div className="mt-6 flex flex-wrap gap-3">
          {accreditations.map((a, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-sm font-medium text-blue-800"
            >
              <Shield size={15} aria-hidden="true" />
              {a.text}
            </span>
          ))}
        </div>
      </Container>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Appointment CTA — only when an approved appointment path exists
// ---------------------------------------------------------------------------

export function AppointmentCTA({ puck }: SectionProps) {
  const h = hospitalFromPuck(puck);
  if (!h) return null;
  const actions = availableActions(h.content);
  const appt = actions.find((a) => a.kind === "appointment");
  if (!appt) return null;
  return (
    <section className="bg-teal-700 py-12 text-white">
      <Container className="flex flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
        <div>
          <h2 className="text-2xl font-bold">Book an appointment</h2>
          <p className="mt-1 text-teal-50/90">Schedule a consultation with {h.content.hospital_name}.</p>
        </div>
        <a
          href={appt.href}
          data-analytics-event="contact_clicked"
          data-preview-slug={h.slug}
          className="inline-flex h-12 items-center rounded-full bg-white px-7 text-base font-semibold text-teal-800"
        >
          {appt.label}
        </a>
      </Container>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Contact — variants: cards | split
// ---------------------------------------------------------------------------

export function ContactSection({ puck, variant = "cards" }: SectionProps) {
  const h = hospitalFromPuck(puck);
  if (!h) return null;
  const { content, slug } = h;
  const c = content.contact;
  const actions = availableActions(content);

  const items: Array<{ icon: typeof Phone; label: string; value: string; event?: string; href?: string }> = [];
  if (c.phone) items.push({ icon: Phone, label: "Phone", value: c.phone, event: "call_clicked", href: `tel:${c.phone}` });
  if (c.email) items.push({ icon: Mail, label: "Email", value: c.email, event: "contact_clicked", href: `mailto:${c.email}` });
  if (c.hours) items.push({ icon: Clock, label: "Hours", value: c.hours });

  return (
    <section id="contact" className="bg-white py-14">
      <Container>
        <SectionHeading eyebrow="Get in touch" title="Contact" />
        <div className={variant === "split" ? "mt-8 grid gap-8 lg:grid-cols-2" : "mt-8 grid gap-4 sm:grid-cols-2"}>
          <div className={variant === "split" ? "space-y-3" : "grid gap-4 sm:col-span-2 sm:grid-cols-2"}>
            {items.map((it) => {
              const Icon = it.icon;
              const inner = (
                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                    <Icon size={16} aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block text-xs uppercase tracking-wide text-slate-400">{it.label}</span>
                    <span className="text-sm font-medium text-slate-800">{it.value}</span>
                  </span>
                </div>
              );
              return it.href ? (
                <a key={it.label} href={it.href} data-analytics-event={it.event} data-preview-slug={slug}>
                  {inner}
                </a>
              ) : (
                <div key={it.label}>{inner}</div>
              );
            })}
          </div>
          {c.address && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
              <h3 className="font-semibold text-slate-900">Visit us</h3>
              <p className="mt-2 text-sm text-slate-600">{c.address}</p>
              <div className="mt-4">
                <ActionButtons actions={actions.filter((a) => a.kind === "directions" || a.kind === "call")} slug={slug} />
              </div>
            </div>
          )}
        </div>
      </Container>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Directions
// ---------------------------------------------------------------------------

export function MapOrDirectionsSection({ puck }: SectionProps) {
  const h = hospitalFromPuck(puck);
  if (!h) return null;
  const address = h.content.contact.address;
  if (!address) return null;
  const directions = availableActions(h.content).find((a) => a.kind === "directions");
  return (
    <section className="bg-slate-50 py-14">
      <Container>
        <div className="flex flex-col items-start justify-between gap-6 rounded-3xl border border-slate-200 bg-white p-8 sm:flex-row sm:items-center">
          <div>
            <SectionHeading eyebrow="Location" title="Find us in Tumakuru" />
            <p className="mt-3 max-w-md text-slate-600">{address}</p>
          </div>
          {directions && (
            <ActionButtons actions={[directions]} slug={h.slug} size="lg" />
          )}
        </div>
      </Container>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------

export function HospitalFooter({ puck }: SectionProps) {
  const h = hospitalFromPuck(puck);
  if (!h) return null;
  const { content } = h;
  return (
    <footer className="border-t border-slate-200 bg-white py-10">
      <Container className="flex flex-col items-center gap-3 text-center">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-teal-700 text-white">
            <ShieldPlus size={16} aria-hidden="true" />
          </span>
          <span className="font-bold text-slate-900">{content.hospital_name}</span>
        </div>
        {content.contact.address && (
          <p className="max-w-md text-sm text-slate-500">{content.contact.address}</p>
        )}
        <p className="text-xs text-slate-400">
          Preview generated by Nasken AI — not an official hospital website.
        </p>
      </Container>
    </footer>
  );
}
