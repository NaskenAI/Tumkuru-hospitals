import { Building2, Shield, Stethoscope, User } from "lucide-react";

import { ContactBlock, SectionHeading, type TemplateProps } from "./shared";

/**
 * Multispecialty template — department-grid heavy, corporate teal. For larger
 * hospitals with several specialties, a doctor roster, facilities, and
 * accreditations.
 */
export function MultispecialtyTemplate({ content, slug }: TemplateProps) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="rounded-2xl bg-gradient-to-br from-teal-700 to-teal-900 px-6 py-12 text-center text-white">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium">
          <Building2 size={14} aria-hidden="true" />
          Multispecialty Hospital
        </span>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
          {content.hospital_name}
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-lg text-teal-50/90">
          {content.tagline.text}
        </p>
      </header>

      <section className="mt-10">
        <SectionHeading accent="text-teal-900">About</SectionHeading>
        <div className="grid gap-3 leading-relaxed text-slate-700 sm:grid-cols-2">
          {content.about.map((p, i) => (
            <p key={i}>{p.text}</p>
          ))}
        </div>
      </section>

      {content.specialties && content.specialties.length > 0 && (
        <section className="mt-10">
          <SectionHeading accent="text-teal-900">Departments</SectionHeading>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {content.specialties.map((s, i) => (
              <div
                key={i}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <Stethoscope
                  className="text-teal-600"
                  size={18}
                  aria-hidden="true"
                />
                <h3 className="mt-2 font-semibold text-slate-950">{s.name}</h3>
                {s.description && (
                  <p className="mt-1 text-sm text-slate-600">{s.description}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {content.doctors && content.doctors.length > 0 && (
        <section className="mt-10">
          <SectionHeading accent="text-teal-900">Our doctors</SectionHeading>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {content.doctors.map((d, i) => (
              <div
                key={i}
                className="rounded-xl border border-slate-200 bg-white p-5 text-center shadow-sm"
              >
                <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-teal-50 text-teal-700">
                  <User size={22} aria-hidden="true" />
                </div>
                <h3 className="mt-3 font-semibold text-slate-950">{d.name}</h3>
                {d.qualification && (
                  <p className="text-xs text-slate-500">{d.qualification}</p>
                )}
                {d.specialty && (
                  <p className="mt-1 text-sm text-teal-700">{d.specialty}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {content.facilities && content.facilities.length > 0 && (
        <section className="mt-10">
          <SectionHeading accent="text-teal-900">Facilities</SectionHeading>
          <div className="grid gap-3 sm:grid-cols-3">
            {content.facilities.map((f, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <Building2
                  className="mt-0.5 shrink-0 text-slate-400"
                  size={18}
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

      {content.accreditations && content.accreditations.length > 0 && (
        <section className="mt-10">
          <SectionHeading accent="text-teal-900">Accreditations</SectionHeading>
          <div className="flex flex-wrap gap-2">
            {content.accreditations.map((a, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-800"
              >
                <Shield size={14} aria-hidden="true" />
                {a.text}
              </span>
            ))}
          </div>
        </section>
      )}

      <section className="mt-10 rounded-2xl border border-slate-200 bg-slate-50 p-6">
        <SectionHeading accent="text-teal-900">
          Contact information
        </SectionHeading>
        <ContactBlock content={content} slug={slug} accentText="text-teal-600" />
      </section>

      {content.insurance && content.insurance.length > 0 && (
        <section className="mt-8">
          <SectionHeading accent="text-teal-900">Insurance</SectionHeading>
          <div className="flex flex-wrap gap-2">
            {content.insurance.map((ins, i) => (
              <span
                key={i}
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
