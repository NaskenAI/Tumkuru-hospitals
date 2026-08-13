import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import * as cheerio from "cheerio";

import type { SourcePage } from "@/lib/normalize/model";

const PAGE_META: Record<string, { path: string; pageType: string }> = {
  home: { path: "/", pageType: "HOME" },
  team: { path: "/our-team/", pageType: "DOCTORS" },
  departments: { path: "/departments/", pageType: "DEPARTMENTS" },
  facilities: { path: "/facilities/", pageType: "FACILITIES" },
  insurers: { path: "/insurances-available/", pageType: "INSURANCE" },
  milestones: { path: "/milestones/", pageType: "ABOUT" },
};

export function gangaHtml(name: string): string {
  const url = fileURLToPath(new URL(`./ganga/${name}.html`, import.meta.url));
  return readFileSync(url, "utf8");
}

export function gangaPage(name: keyof typeof PAGE_META): SourcePage {
  const meta = PAGE_META[name];
  return {
    id: name,
    url: `https://gangahospitaltumkur.com${meta.path}`,
    tier: 2,
    pageType: meta.pageType,
    html: gangaHtml(name),
  };
}

export function loadGanga(name: keyof typeof PAGE_META) {
  const page = gangaPage(name);
  const $ = cheerio.load(page.html);
  const pageText = $("body").text();
  return { $, page, pageText };
}

export function loadAllGangaPages(): SourcePage[] {
  return (Object.keys(PAGE_META) as (keyof typeof PAGE_META)[]).map(gangaPage);
}
