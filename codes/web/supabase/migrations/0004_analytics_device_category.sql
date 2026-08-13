-- Step 4: coarse device categories only (no fingerprinting). Replace the
-- previous ('mobile','desktop','unknown') set with the agreed coarse buckets.
alter table public.analytics_events
  drop constraint if exists analytics_events_device_category_check;
alter table public.analytics_events
  add constraint analytics_events_device_category_check
  check (device_category in ('mobile', 'desktop', 'tablet_or_other'));
