-- P0-2: store real HTML for the deterministic website audit.
-- The audit needs actual tags/attributes (meta viewport, title, tel: links),
-- which the text-only raw_text column strips out.
alter table public.sources
  add column if not exists raw_html text;

-- P1: cross-import duplicate detection. import_fingerprint must be unique so a
-- re-imported CSV row cannot create a second lead. Existing duplicates (if any)
-- must be resolved before this constraint will apply.
create unique index if not exists leads_import_fingerprint_key
  on public.leads(import_fingerprint);

-- P1: idempotent generated content — one row per (lead, template). Re-running
-- generation upserts instead of stacking duplicate rows.
create unique index if not exists generated_content_lead_template_key
  on public.generated_content(lead_id, template_key);

-- P0-4: explicit human approval states between review and deploy.
-- EN_APPROVED  = a human approved the English content.
-- KN_APPROVED  = a human approved the Kannada content.
alter table public.generated_content
  drop constraint if exists generated_content_status_check;
alter table public.generated_content
  add constraint generated_content_status_check check (status in (
    'DRAFT',
    'EN_REVIEW_REQUIRED',
    'EN_APPROVED',
    'KN_REVIEW_REQUIRED',
    'KN_APPROVED',
    'VALIDATED',
    'BLOCKED'
  ));

-- P0-4: record who approved each language and when (provenance, mirrors the
-- hospital_facts verified_by/verified_at pattern).
alter table public.generated_content
  add column if not exists en_approved_by text,
  add column if not exists en_approved_at timestamptz,
  add column if not exists kn_approved_by text,
  add column if not exists kn_approved_at timestamptz;
