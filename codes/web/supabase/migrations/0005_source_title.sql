-- Step 6: store a human-readable source label (the page <title>) so the fact
-- reviewer can see the source title alongside the URL and retrieval time.
alter table public.sources
  add column if not exists title text;
