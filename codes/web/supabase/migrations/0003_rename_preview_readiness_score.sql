-- Step 10: the score formerly called "commercial_fit" measures whether we have
-- enough verified data to build a useful preview (specialties, doctors, contact,
-- content richness) — not whether the hospital will buy. Rename it to
-- preview_readiness_score. Heuristic weights; not a predictive/commercial signal.
alter table public.leads
  rename column commercial_fit_score to preview_readiness_score;

alter table public.website_audits
  rename column commercial_fit_score to preview_readiness_score;
