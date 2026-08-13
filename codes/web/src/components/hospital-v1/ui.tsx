import type { ReactNode } from "react";

import type { NormalizedHospital } from "@/lib/normalize/model";

// --- Design tokens (clinical / editorial, Section 30) -----------------------
// Deep institutional teal-blue primary; ink text; red reserved for emergency.
export const BRAND = "#0e5a6b";
export const BRAND_DK = "#0a4653";

export function assetUrl(id: string): string {
  return `/api/assets/${id}`;
}

export function googleMapsHref(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

/** Grounded patient actions derived from the model (never inferred). */
export function hospitalActions(model: NormalizedHospital) {
  const phone = model.contact.phones[0]?.value ?? null;
  const address = model.location.address?.value ?? null;
  const appt =
    model.appointment.channel !== "none" ? model.appointment.value ?? null : null;
  return {
    bookHref: appt,
    appointmentChannel: model.appointment.channel,
    callHref: phone ? `tel:${phone.replace(/\s+/g, "")}` : null,
    phoneDisplay: phone,
    directionsHref: address ? googleMapsHref(address) : null,
    findDoctorHref: model.people.doctors.length > 0 ? "#doctors" : null,
  };
}

export function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-6xl px-5 sm:px-8 ${className}`}>{children}</div>;
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: BRAND }}>
      {children}
    </p>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  className = "",
}: {
  eyebrow?: string;
  title: string;
  className?: string;
}) {
  return (
    <div className={className}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h2 className="mt-2 font-serif text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
        {title}
      </h2>
    </div>
  );
}

type LinkProps = {
  href: string;
  children: ReactNode;
  event?: string;
  slug?: string;
  external?: boolean;
  className?: string;
};

export function PrimaryButton({ href, children, event, slug, external, className = "" }: LinkProps) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      data-analytics-event={event}
      data-preview-slug={slug}
      className={`inline-flex h-11 items-center justify-center rounded-md px-5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${className}`}
      style={{ backgroundColor: BRAND }}
    >
      {children}
    </a>
  );
}

export function SecondaryButton({ href, children, event, slug, external, className = "" }: LinkProps) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      data-analytics-event={event}
      data-preview-slug={slug}
      className={`inline-flex h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-800 transition hover:border-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${className}`}
    >
      {children}
    </a>
  );
}

export function ArrowLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      className="group inline-flex items-center gap-1.5 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      style={{ color: BRAND }}
    >
      {children}
      <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">→</span>
    </a>
  );
}
