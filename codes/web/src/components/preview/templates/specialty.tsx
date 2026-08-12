import { Stethoscope, User } from "lucide-react";

import { ContactBlock, SectionHeading, type TemplateProps } from "./shared";

/**
 * Specialty template — two-column, focused on one clinical strength. Main
 * column carries the narrative + specialties + doctors; a sticky sidebar holds
 * contact. Indigo accent.
 */
export function SpecialtyTemplate({ content, slug }: TemplateProps) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8 border-l-4 border-indigo-500 pl-5">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
          <Stethoscope size={14} aria-hidden="true" />
          Specialty Hospital
        </span>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
          {content.hospital_name}
        </h1>
        <p className="mt-3 max-w-2xl text-lg text-slate-600">
          {content.tagline.text}
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <section className="mb-8">
            <SectionHeading accent="text-indigo-900">About</SectionHeading>
            <div className="space-y-3 leading-relaxed text-slate-700">
              {content.about.map((p, i) => (
                <p key={i}>{p.text}</p>
              ))}
            </div>
          </section>

          {content.specialties && content.specialties.length > 0 && (
            <section className="mb-8">
              <SectionHeading accent="text-indigo-900">
                Areas of focus
              </SectionHeading>
              <div className="flex flex-wrap gap-2">
                {content.specialties.map((s, i) => (
                  <span
                    key={i}
                    className="rounded-lg border border-indigo-100 bg-indigo-50/60 px-4 py-2 text-sm font-medium text-indigo-800"
                  >
                    {s.name}
                  </span>
                ))}
              </div>
            </section>
          )}

          {content.doctors && content.doctors.length > 0 && (
            <section className="mb-8">
              <SectionHeading accent="text-indigo-900">
                Our specialists
              </SectionHeading>
              <div className="space-y-3">
                {content.doctors.map((d, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex size-11 items-center justify-center rounded-full bg-indigo-50 text-indigo-700">
                      <User size={20} aria-hidden="true" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-950">{d.name}</h3>
                      <p className="text-sm text-slate-500">
                        {[d.qualification, d.specialty]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="lg:col-span-1">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 lg:sticky lg:top-6">
            <SectionHeading accent="text-indigo-900">Contact</SectionHeading>
            <ContactBlock
              content={content}
              slug={slug}
              accentText="text-indigo-600"
              layout="stack"
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
