import { redirect } from "next/navigation";

// Compatibility alias: /preview/[slug]/v1 → /preview/[slug] (now the canonical
// Hospital V1 preview). Kept so previously-shared /v1 links keep working.
export const dynamic = "force-dynamic";

export default async function HospitalV1Alias({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { slug } = await params;
  const { lang } = await searchParams;
  redirect(`/preview/${slug}${lang === "kn" ? "?lang=kn" : ""}`);
}
