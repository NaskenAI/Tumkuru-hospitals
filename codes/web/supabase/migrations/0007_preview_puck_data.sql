-- Puck spike: store the editable LAYOUT specification (component tree + variants)
-- for a preview. This is presentation-only data (no facts) — factual copy stays
-- in generated_content and continues to pass claim validation. Nullable: when
-- absent, a deterministic default page is derived from approved content.
alter table public.previews
  add column if not exists puck_data jsonb;
