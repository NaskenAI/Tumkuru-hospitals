import { Clock, Mail, MessageCircle, Navigation, Phone } from "lucide-react";
import type { ReactNode } from "react";

import type { GeneratedContent } from "@/lib/content/content-schema";

export type TemplateProps = {
  content: GeneratedContent;
  slug: string;
};

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/** Build a wa.me link; assume India (+91) for bare 10-digit numbers. */
export function whatsappLink(phone: string): string | null {
  const digits = digitsOnly(phone);
  if (digits.length < 10) return null;
  const withCc = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${withCc}`;
}

export function directionsLink(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    address,
  )}`;
}

export function SectionHeading({
  children,
  accent,
}: {
  children: ReactNode;
  accent: string;
}) {
  return (
    <h2 className={`mb-4 text-xl font-semibold ${accent}`}>{children}</h2>
  );
}

/**
 * Contact block with real analytics-instrumented CTAs. `data-analytics-event`
 * attributes are picked up by <PreviewAnalytics>.
 */
export function ContactBlock({
  content,
  slug,
  accentText = "text-teal-600",
  layout = "grid",
}: TemplateProps & { accentText?: string; layout?: "grid" | "stack" }) {
  const { contact } = content;
  const wa = contact.phone ? whatsappLink(contact.phone) : null;

  const containerClass =
    layout === "grid"
      ? "grid gap-3 sm:grid-cols-2"
      : "flex flex-col gap-3";

  return (
    <div className={containerClass}>
      {contact.phone && (
        <a
          href={`tel:${contact.phone}`}
          className="flex items-center gap-3 rounded-md bg-white p-3 text-sm text-slate-700 shadow-sm transition hover:shadow-md"
          data-analytics-event="call_clicked"
          data-preview-slug={slug}
        >
          <Phone className={accentText} size={18} aria-hidden="true" />
          {contact.phone}
        </a>
      )}
      {wa && (
        <a
          href={wa}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-md bg-white p-3 text-sm text-slate-700 shadow-sm transition hover:shadow-md"
          data-analytics-event="whatsapp_clicked"
          data-preview-slug={slug}
        >
          <MessageCircle className={accentText} size={18} aria-hidden="true" />
          WhatsApp
        </a>
      )}
      {contact.address && (
        <a
          href={directionsLink(contact.address)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-start gap-3 rounded-md bg-white p-3 text-sm text-slate-700 shadow-sm transition hover:shadow-md sm:col-span-2"
          data-analytics-event="directions_clicked"
          data-preview-slug={slug}
        >
          <Navigation
            className={`mt-0.5 shrink-0 ${accentText}`}
            size={18}
            aria-hidden="true"
          />
          <span>
            {contact.address}
            <span className="mt-0.5 block text-xs text-slate-400">
              Get directions
            </span>
          </span>
        </a>
      )}
      {contact.email && (
        <a
          href={`mailto:${contact.email}`}
          className="flex items-center gap-3 rounded-md bg-white p-3 text-sm text-slate-700 shadow-sm transition hover:shadow-md"
          data-analytics-event="contact_clicked"
          data-preview-slug={slug}
        >
          <Mail className={accentText} size={18} aria-hidden="true" />
          {contact.email}
        </a>
      )}
      {contact.hours && (
        <div className="flex items-center gap-3 rounded-md bg-white p-3 text-sm text-slate-700 shadow-sm">
          <Clock className={accentText} size={18} aria-hidden="true" />
          {contact.hours}
        </div>
      )}
      {contact.emergency && (
        <div className="flex items-center gap-3 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-800 shadow-sm">
          <Phone className="text-rose-600" size={18} aria-hidden="true" />
          Emergency: {contact.emergency}
        </div>
      )}
    </div>
  );
}

export function MapList({
  items,
}: {
  items: Array<{ name: string; description?: string }>;
}) {
  return (
    <ul className="space-y-2 text-slate-700">
      {items.map((item, i) => (
        <li key={i} className="flex flex-col">
          <span className="font-medium text-slate-900">{item.name}</span>
          {item.description && (
            <span className="text-sm text-slate-500">{item.description}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
