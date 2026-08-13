-- Phase B: per-page provenance for the multi-page first-party crawl.
alter table public.sources
  add column if not exists page_type text,
  add column if not exists discovered_from text,
  add column if not exists crawl_depth integer;

-- Phase E: first-party image asset inventory. Assets are imagery (not factual
-- evidence): each keeps full provenance (source page + original URL) and an
-- approval_status. Classification is a hint, never a fact.
create table if not exists public.hospital_assets (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  source_id uuid references public.sources(id) on delete set null,
  source_page_url text,
  original_asset_url text not null,
  mime_type text,
  width integer,
  height integer,
  alt_text text,
  classification text not null default 'OTHER'
    check (classification in (
      'LOGO','HOSPITAL_EXTERIOR','HOSPITAL_INTERIOR','HERO','DOCTOR',
      'FACILITY','DEPARTMENT','INSURANCE_LOGO','GALLERY','ICON','OTHER'
    )),
  quality_score integer not null default 0,
  approval_status text not null default 'PENDING'
    check (approval_status in ('PENDING','APPROVED','REJECTED')),
  created_at timestamptz not null default now()
);

create index if not exists hospital_assets_lead_id_idx on public.hospital_assets(lead_id);
create unique index if not exists hospital_assets_lead_url_key
  on public.hospital_assets(lead_id, original_asset_url);

-- The app connects as service_role (bypasses RLS); grant explicitly.
grant all privileges on public.hospital_assets to service_role;
