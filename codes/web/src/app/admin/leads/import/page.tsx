import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { LeadImportForm } from "@/components/lead-import-form";

export default function LeadImportPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-5">
          <Link
            className="inline-flex w-fit items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-950"
            href="/admin/leads"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            Leads
          </Link>
          <div>
            <p className="text-sm font-medium text-teal-700">Leads</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal text-slate-950">
              Import prospects
            </h1>
          </div>
        </header>

        <LeadImportForm />
      </div>
    </main>
  );
}
