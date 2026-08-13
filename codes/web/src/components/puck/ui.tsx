import {
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  CalendarDays,
} from "lucide-react";
import type { ReactNode } from "react";

import type { HospitalAction } from "@/lib/puck/actions";

export function Container({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mx-auto w-full max-w-6xl px-5 sm:px-8 ${className}`}>
      {children}
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  align = "left",
}: {
  eyebrow?: string;
  title: string;
  align?: "left" | "center";
}) {
  return (
    <div className={align === "center" ? "text-center" : ""}>
      {eyebrow && (
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--brand)]">
          {eyebrow}
        </p>
      )}
      <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
        {title}
      </h2>
    </div>
  );
}

const ACTION_ICON = {
  call: Phone,
  directions: Navigation,
  whatsapp: MessageCircle,
  appointment: CalendarDays,
} as const;

export function ActionButtons({
  actions,
  slug,
  size = "md",
  tone = "default",
}: {
  actions: HospitalAction[];
  slug: string;
  size?: "md" | "lg";
  /** "on-dark" inverts button colors for use over a dark hero photo. */
  tone?: "default" | "on-dark";
}) {
  if (actions.length === 0) return null;
  const pad = size === "lg" ? "h-12 px-6 text-base" : "h-10 px-4 text-sm";
  const primaryClass =
    tone === "on-dark"
      ? "bg-white text-[var(--brand-strong)] shadow-sm hover:bg-white/90"
      : "bg-[var(--brand)] text-[var(--on-brand)] shadow-sm hover:bg-[var(--brand-strong)]";
  const secondaryClass =
    tone === "on-dark"
      ? "border border-white/40 bg-transparent text-white hover:bg-white/10"
      : "border border-slate-300 bg-white text-slate-800 hover:border-slate-400";
  return (
    <div className="flex flex-wrap gap-3">
      {actions.map((a, i) => {
        const Icon = ACTION_ICON[a.kind];
        const primary = i === 0;
        const analyticsEvent =
          a.kind === "call"
            ? "call_clicked"
            : a.kind === "directions"
              ? "directions_clicked"
              : a.kind === "whatsapp"
                ? "whatsapp_clicked"
                : "contact_clicked";
        return (
          <a
            key={a.kind}
            href={a.href}
            target={a.kind === "directions" || a.kind === "whatsapp" ? "_blank" : undefined}
            rel="noopener noreferrer"
            data-analytics-event={analyticsEvent}
            data-preview-slug={slug}
            className={`inline-flex items-center justify-center gap-2 rounded-full font-semibold transition ${pad} ${
              primary ? primaryClass : secondaryClass
            }`}
          >
            <Icon size={size === "lg" ? 18 : 16} aria-hidden="true" />
            {a.label}
          </a>
        );
      })}
    </div>
  );
}

export function AddressLine({ address }: { address: string }) {
  return (
    <span className="inline-flex items-start gap-2 text-slate-600">
      <MapPin className="mt-0.5 shrink-0 text-[var(--brand)]" size={16} aria-hidden="true" />
      {address}
    </span>
  );
}
