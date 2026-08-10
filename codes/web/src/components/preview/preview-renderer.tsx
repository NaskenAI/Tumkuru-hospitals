/**
 * Preview renderer — renders the appropriate template based on templateKey.
 * This is a pure presentational component — no data fetching.
 */

import {
  Building2,
  Clock,
  Mail,
  MapPin,
  Phone,
  Shield,
  Stethoscope,
  User,
} from "lucide-react";

import type { GeneratedContent, TemplateKey } from "@/lib/content/content-schema";

type PreviewRendererProps = {
  content: GeneratedContent;
  templateKey: TemplateKey;
  slug: string;
};

export function PreviewRenderer({
  content,
  templateKey,
  slug,
}: PreviewRendererProps) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Hero */}
      <header className="mb-10 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
          {content.hospital_name}
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
          {content.tagline.text}
        </p>
        {templateKey !== "clinic" && (
          <div className="mt-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-3 py-1 text-xs font-medium text-teal-800">
              <Building2 size={14} aria-hidden="true" />
              {templateKey === "multispecialty"
                ? "Multispecialty Hospital"
                : "Specialty Hospital"}
            </span>
          </div>
        )}
      </header>

      {/* About */}
      <section className="mb-10">
        <h2 className="mb-4 text-xl font-semibold text-slate-950">About</h2>
        <div className="space-y-3 text-slate-700 leading-relaxed">
          {content.about.map((paragraph, i) => (
            <p key={`about-${i}`}>{paragraph.text}</p>
          ))}
        </div>
      </section>

      {/* Specialties */}
      {content.specialties && content.specialties.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-4 text-xl font-semibold text-slate-950">
            Specialties
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {content.specialties.map((s, i) => (
              <div
                key={`specialty-${i}`}
                className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <Stethoscope
                    className="text-teal-600"
                    size={16}
                    aria-hidden="true"
                  />
                  <h3 className="font-medium text-slate-950">{s.name}</h3>
                </div>
                {s.description && (
                  <p className="mt-2 text-sm text-slate-600">{s.description}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Services */}
      {content.services && content.services.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-4 text-xl font-semibold text-slate-950">
            Services
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {content.services.map((s, i) => (
              <div
                key={`service-${i}`}
                className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
              >
                <h3 className="font-medium text-slate-950">{s.name}</h3>
                {s.description && (
                  <p className="mt-1 text-sm text-slate-600">{s.description}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Doctors */}
      {content.doctors && content.doctors.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-4 text-xl font-semibold text-slate-950">
            Our Doctors
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {content.doctors.map((d, i) => (
              <div
                key={`doctor-${i}`}
                className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-full bg-teal-50 text-teal-700">
                    <User size={18} aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="font-medium text-slate-950">{d.name}</h3>
                    {d.qualification && (
                      <p className="text-xs text-slate-500">
                        {d.qualification}
                      </p>
                    )}
                  </div>
                </div>
                {d.specialty && (
                  <p className="mt-3 text-sm text-teal-700">{d.specialty}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Facilities */}
      {content.facilities && content.facilities.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-4 text-xl font-semibold text-slate-950">
            Facilities
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {content.facilities.map((f, i) => (
              <div
                key={`facility-${i}`}
                className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
              >
                <Building2
                  className="mt-0.5 shrink-0 text-slate-400"
                  size={16}
                  aria-hidden="true"
                />
                <div>
                  <h3 className="font-medium text-slate-950">{f.name}</h3>
                  {f.description && (
                    <p className="mt-1 text-sm text-slate-600">
                      {f.description}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Accreditations */}
      {content.accreditations && content.accreditations.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-4 text-xl font-semibold text-slate-950">
            Accreditations
          </h2>
          <div className="flex flex-wrap gap-2">
            {content.accreditations.map((a, i) => (
              <span
                key={`accr-${i}`}
                className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-800"
              >
                <Shield size={14} aria-hidden="true" />
                {a.text}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Contact */}
      <section className="mb-10 rounded-lg border border-slate-200 bg-slate-50 p-6">
        <h2 className="mb-4 text-xl font-semibold text-slate-950">
          Contact Information
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {content.contact.phone && (
            <a
              href={`tel:${content.contact.phone}`}
              className="flex items-center gap-3 rounded-md bg-white p-3 text-sm text-slate-700 shadow-sm transition hover:shadow-md"
              data-analytics-event="call_clicked"
              data-preview-slug={slug}
            >
              <Phone className="text-teal-600" size={18} aria-hidden="true" />
              {content.contact.phone}
            </a>
          )}
          {content.contact.email && (
            <a
              href={`mailto:${content.contact.email}`}
              className="flex items-center gap-3 rounded-md bg-white p-3 text-sm text-slate-700 shadow-sm transition hover:shadow-md"
              data-analytics-event="contact_clicked"
              data-preview-slug={slug}
            >
              <Mail className="text-teal-600" size={18} aria-hidden="true" />
              {content.contact.email}
            </a>
          )}
          {content.contact.address && (
            <div className="flex items-start gap-3 rounded-md bg-white p-3 text-sm text-slate-700 shadow-sm sm:col-span-2">
              <MapPin
                className="mt-0.5 shrink-0 text-teal-600"
                size={18}
                aria-hidden="true"
              />
              {content.contact.address}
            </div>
          )}
          {content.contact.hours && (
            <div className="flex items-center gap-3 rounded-md bg-white p-3 text-sm text-slate-700 shadow-sm">
              <Clock className="text-teal-600" size={18} aria-hidden="true" />
              {content.contact.hours}
            </div>
          )}
          {content.contact.emergency && (
            <div className="flex items-center gap-3 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-800 shadow-sm">
              <Phone className="text-rose-600" size={18} aria-hidden="true" />
              Emergency: {content.contact.emergency}
            </div>
          )}
        </div>
      </section>

      {/* Insurance */}
      {content.insurance && content.insurance.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-4 text-xl font-semibold text-slate-950">
            Insurance
          </h2>
          <div className="flex flex-wrap gap-2">
            {content.insurance.map((ins, i) => (
              <span
                key={`ins-${i}`}
                className="rounded-full bg-slate-100 px-3 py-1.5 text-sm text-slate-700"
              >
                {ins.text}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
