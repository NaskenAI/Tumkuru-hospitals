import { writeFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { collectFirstPartySite } from "@/lib/research/collect-site";
import { normalizedHost } from "@/lib/research/page-classifier";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

// Live, network + local-Supabase E2E of the multi-page crawl + asset inventory.
// Skipped in the normal suite; run explicitly:
//   RUN_LIVE_CRAWL=1 node --env-file=.env.local node_modules/.bin/vitest run \
//     src/lib/research/crawl-ganga.live.test.ts
// Optional CLEAN_CRAWL=1 removes crawl-added pages + all assets first, for a
// fully reproducible fresh run. Optional SP=<dir> writes an evidence JSON.
const RUN = process.env.RUN_LIVE_CRAWL === "1";
const GANGA_LEAD_ID = "fa98583a-9cb4-4ba7-bbe6-139e366c38a8";

describe.skipIf(!RUN)("live: crawl Ganga first-party site", () => {
  it("crawls same-origin pages and inventories first-party assets", async () => {
    const supabase = createSupabaseServiceClient();
    const { data: lead, error } = await supabase
      .from("leads")
      .select("known_website")
      .eq("id", GANGA_LEAD_ID)
      .single();
    if (error || !lead?.known_website) throw new Error("Ganga lead not found");
    const root = lead.known_website;

    if (process.env.CLEAN_CRAWL === "1") {
      // Reproducibility: drop crawl-added pages (page_type set) + all assets,
      // but keep the original homepage source that facts were extracted from.
      await supabase.from("hospital_assets").delete().eq("lead_id", GANGA_LEAD_ID);
      await supabase
        .from("sources")
        .delete()
        .eq("lead_id", GANGA_LEAD_ID)
        .not("page_type", "is", null);
    }

    const summary = await collectFirstPartySite(supabase, GANGA_LEAD_ID, root);

    const offOrigin = summary.pages.filter(
      (p) => normalizedHost(p.url) !== normalizedHost(root),
    ).length;
    const maxDepth = summary.pages.reduce((m, p) => Math.max(m, p.crawlDepth), 0);

    console.log(
      "\nCRAWL EVIDENCE\n" +
        JSON.stringify({ offOrigin, maxDepth, ...summary }, null, 2) +
        "\n",
    );
    if (process.env.SP) {
      writeFileSync(
        `${process.env.SP}/crawl-evidence.json`,
        JSON.stringify({ offOrigin, maxDepth, ...summary }, null, 2),
      );
    }

    expect(summary.pagesCrawled).toBeGreaterThan(1);
    expect(summary.pagesCrawled).toBeLessThanOrEqual(20);
    expect(maxDepth).toBeLessThanOrEqual(2);
    expect(offOrigin).toBe(0);
    expect(summary.assetsFound).toBeGreaterThan(0);
  }, 180_000);
});
