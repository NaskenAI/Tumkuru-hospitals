import { Stethoscope } from "lucide-react";

import { ContactBlock, MapList, SectionHeading, type TemplateProps } from "./shared";

/**
 * Clinic template — compact, warm, single-column. For small clinics with a
 * short services list and no specialty/doctor grid.
 */
export function ClinicTemplate({ content, slug }: TemplateProps) {
  const services = [
    ...(content.services ?? []),
    ...(content.facilities ?? []),
  ];

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <header className="rounded-2xl bg-amber-50 px-6 py-10 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-amber-950">
          {content.hospital_name}
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-base text-amber-900/80">
          {content.tagline.text}
        </p>
      </header>

      <section className="mt-8">
        <SectionHeading accent="text-amber-900">About</SectionHeading>
        <div className="space-y-3 leading-relaxed text-slate-700">
          {content.about.map((p, i) => (
            <p key={i}>{p.text}</p>
          ))}
        </div>
      </section>

      {services.length > 0 && (
        <section className="mt-8">
          <SectionHeading accent="text-amber-900">Services</SectionHeading>
          <div className="rounded-xl border border-amber-100 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2 text-amber-700">
              <Stethoscope size={18} aria-hidden="true" />
              <span className="text-sm font-medium">What we offer</span>
            </div>
            <MapList items={services} />
          </div>
        </section>
      )}

      <section className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-6">
        <SectionHeading accent="text-amber-900">Contact</SectionHeading>
        <ContactBlock
          content={content}
          slug={slug}
          accentText="text-amber-600"
          layout="stack"
        />
      </section>
    </div>
  );
}
