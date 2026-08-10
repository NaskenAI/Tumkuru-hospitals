create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  hospital_name text not null,
  normalized_name text not null,
  district text not null default 'Tumakuru',
  city text,
  normalized_city text,
  known_phone text,
  known_email text,
  known_website text,
  source_type text not null default 'MANUAL'
    check (source_type in ('OFFICIAL_WEBSITE', 'GOVERNMENT_DIRECTORY', 'MANUAL', 'OTHER')),
  seed_source_url text,
  import_fingerprint text not null,
  duplicate_group text,
  duplicate_of uuid references public.leads(id) on delete set null,
  status text not null default 'NEW'
    check (status in (
      'NEW',
      'RESEARCHING',
      'RESEARCHED',
      'REVIEW_REQUIRED',
      'QUALIFIED',
      'PREVIEW_READY',
      'CONTACTED',
      'WON',
      'LOST',
      'SKIPPED'
    )),
  digital_gap_score integer,
  commercial_fit_score integer,
  score_breakdown jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leads_status_idx on public.leads(status);
create index if not exists leads_import_fingerprint_idx on public.leads(import_fingerprint);
create index if not exists leads_normalized_name_city_idx on public.leads(normalized_name, normalized_city);

drop trigger if exists leads_set_updated_at on public.leads;
create trigger leads_set_updated_at
before update on public.leads
for each row execute function public.set_updated_at();

create table if not exists public.sources (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  url text,
  source_type text not null
    check (source_type in ('OFFICIAL_WEBSITE', 'GOVERNMENT_DIRECTORY', 'MANUAL', 'OTHER')),
  retrieved_at timestamptz,
  http_status integer,
  content_hash text,
  raw_text text,
  raw_text_expires_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists sources_lead_id_idx on public.sources(lead_id);
create index if not exists sources_content_hash_idx on public.sources(content_hash);

create table if not exists public.hospital_facts (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  source_id uuid references public.sources(id) on delete set null,
  fact_type text not null,
  value jsonb not null,
  risk_tier text not null check (risk_tier in ('LOW', 'MEDIUM', 'HIGH')),
  source_excerpt text,
  verification_status text not null default 'UNVERIFIED'
    check (verification_status in ('UNVERIFIED', 'VERIFIED', 'REJECTED')),
  verified_by text,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hospital_facts_lead_id_idx on public.hospital_facts(lead_id);
create index if not exists hospital_facts_verification_status_idx on public.hospital_facts(verification_status);

drop trigger if exists hospital_facts_set_updated_at on public.hospital_facts;
create trigger hospital_facts_set_updated_at
before update on public.hospital_facts
for each row execute function public.set_updated_at();

create table if not exists public.website_audits (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  audit_run_id text not null,
  website_url text,
  checks jsonb not null default '{}'::jsonb,
  digital_gap_score integer not null default 0,
  commercial_fit_score integer not null default 0,
  score_breakdown jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists website_audits_lead_id_idx on public.website_audits(lead_id);

create table if not exists public.generated_content (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  template_key text not null check (template_key in ('clinic', 'specialty', 'multispecialty')),
  content_en jsonb,
  content_kn jsonb,
  status text not null default 'DRAFT'
    check (status in ('DRAFT', 'EN_REVIEW_REQUIRED', 'KN_REVIEW_REQUIRED', 'VALIDATED', 'BLOCKED')),
  validation_report jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists generated_content_lead_id_idx on public.generated_content(lead_id);

drop trigger if exists generated_content_set_updated_at on public.generated_content;
create trigger generated_content_set_updated_at
before update on public.generated_content
for each row execute function public.set_updated_at();

create table if not exists public.previews (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  generated_content_id uuid references public.generated_content(id) on delete set null,
  slug text not null unique,
  disclaimer_en text not null,
  disclaimer_kn text,
  noindex boolean not null default true,
  deployed_at timestamptz,
  stale_after timestamptz,
  status text not null default 'DRAFT'
    check (status in ('DRAFT', 'READY', 'DEPLOYED', 'STALE', 'REMOVED')),
  desktop_screenshot_path text,
  mobile_screenshot_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists previews_lead_id_idx on public.previews(lead_id);
create index if not exists previews_slug_idx on public.previews(slug);

drop trigger if exists previews_set_updated_at on public.previews;
create trigger previews_set_updated_at
before update on public.previews
for each row execute function public.set_updated_at();

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete set null,
  preview_id uuid references public.previews(id) on delete cascade,
  event text not null check (event in (
    'preview_opened',
    'page_viewed',
    'call_clicked',
    'whatsapp_clicked',
    'directions_clicked',
    'contact_clicked'
  )),
  device_category text check (device_category in ('mobile', 'desktop', 'unknown')),
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_preview_id_idx on public.analytics_events(preview_id);
create index if not exists analytics_events_lead_id_idx on public.analytics_events(lead_id);

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete cascade,
  job_type text not null check (job_type in (
    'collectSources',
    'extractFacts',
    'auditWebsite',
    'scoreLead',
    'generateContent',
    'translateContent',
    'validateClaims',
    'renderPreview',
    'deployPreview',
    'captureScreenshots',
    'generateOutreachDraft'
  )),
  status text not null default 'PENDING'
    check (status in ('PENDING', 'RUNNING', 'SUCCESS', 'FAILED')),
  started_at timestamptz,
  completed_at timestamptz,
  error text,
  model text,
  tokens integer,
  estimated_cost numeric(12, 4),
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists jobs_status_created_at_idx on public.jobs(status, created_at);
create index if not exists jobs_lead_id_idx on public.jobs(lead_id);

drop trigger if exists jobs_set_updated_at on public.jobs;
create trigger jobs_set_updated_at
before update on public.jobs
for each row execute function public.set_updated_at();

alter table public.leads enable row level security;
alter table public.sources enable row level security;
alter table public.hospital_facts enable row level security;
alter table public.website_audits enable row level security;
alter table public.generated_content enable row level security;
alter table public.previews enable row level security;
alter table public.analytics_events enable row level security;
alter table public.jobs enable row level security;
