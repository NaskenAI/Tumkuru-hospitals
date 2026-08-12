import { Database, FileSpreadsheet, Globe, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { LogoutButton } from "@/components/admin/logout-button";

const navCards = [
  {
    title: "Lead list",
    detail: "View, import, and manage hospital prospects with scores",
    href: "/admin/leads",
    icon: Database,
    color: "bg-teal-50 text-teal-700",
  },
  {
    title: "Import CSV",
    detail: "Upload prospect data from a CSV file",
    href: "/admin/leads/import",
    icon: FileSpreadsheet,
    color: "bg-blue-50 text-blue-700",
  },
];

export default function AdminPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-teal-700">
              Nasken AI · Tumakuru Pilot
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
              Admin Dashboard
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Hospital preview pipeline — manage leads, review facts, generate
              previews.
            </p>
          </div>
          <LogoutButton />
        </header>

        <section className="grid gap-4 sm:grid-cols-2">
          {navCards.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.title}
                href={card.href}
                className="group rounded-lg border border-slate-200 bg-white p-6 shadow-sm transition hover:border-teal-300 hover:shadow-md"
              >
                <div
                  className={`flex size-10 items-center justify-center rounded-md ${card.color}`}
                >
                  <Icon size={20} aria-hidden="true" />
                </div>
                <h2 className="mt-4 text-base font-semibold text-slate-950 group-hover:text-teal-700">
                  {card.title}
                </h2>
                <p className="mt-1 text-sm text-slate-500">{card.detail}</p>
              </Link>
            );
          })}
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <Globe className="mt-0.5 text-teal-600" size={18} aria-hidden="true" />
              <div>
                <h2 className="text-base font-semibold text-slate-950">
                  Pipeline steps
                </h2>
                <ol className="mt-3 space-y-2 text-sm text-slate-600">
                  <li>1. Import leads from CSV</li>
                  <li>2. Collect source text (safe fetch)</li>
                  <li>3. Extract facts with LLM</li>
                  <li>4. Human review (approve/edit/reject)</li>
                  <li>5. Audit website + score lead</li>
                  <li>6. Generate English → approve English</li>
                  <li>7. Translate to Kannada → approve Kannada</li>
                  <li>8. Deploy preview with disclaimer</li>
                </ol>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 text-rose-600" size={18} aria-hidden="true" />
              <div>
                <h2 className="text-base font-semibold text-slate-950">
                  Pilot safety rule
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Every preview-facing fact must remain tied to a source and
                  human verification during the pilot. Unsupported facts block
                  preview deployment. Zero unsupported facts on anything shown
                  to a real hospital.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
