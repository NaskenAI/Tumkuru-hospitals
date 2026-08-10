# Start Work Plan

Use this as the first execution checklist. The aim is to reach the first weekly
demo quickly: a CSV lead goes in, and a sourced structured hospital profile
comes out.

## Immediate Rule

All code and research work should stay inside this repo:

`E:\Internships\Nasken AI pvt Ltd\Tumkuru hospitals\Tumkuru-hospitals`

## Step 1 - Prepare The Project Skeleton

Create the application under:

`codes/web`

Recommended stack:

- Next.js
- TypeScript
- Tailwind CSS
- App Router
- Supabase/Postgres
- Zod
- Vitest
- Playwright

Do not start with a monorepo, Kubernetes, queues, or microservices.

## Step 2 - Set Up Environment Files

Create local environment variables for:

- Supabase URL
- Supabase service role key for server-side/admin operations
- Supabase anon key for client-safe operations
- Chosen LLM provider API key
- AI cost cap per run
- AI token cap per lead

Never commit secrets.

## Step 3 - Create Database Schema

Start with these tables:

- `leads`
- `sources`
- `hospital_facts`
- `website_audits`
- `generated_content`
- `previews`
- `analytics_events`
- `jobs`

The first migration should focus on fields required for import, extraction,
review, and provenance.

## Step 4 - Build CSV Import

Use the template at:

`research/prospect_seed_template.csv`

Minimum behavior:

- Read hospital name, city, phone, email, website, and source info.
- Normalize names, phone numbers, websites, and cities.
- Detect likely duplicates.
- Store imported leads with status `NEW`.

## Step 5 - Build Safe Source Collection

For each lead:

- Use the seed website if available.
- Allow manually added source URLs.
- Fetch only safe `http` and `https` URLs.
- Reject private IPs and unsafe redirects.
- Store source snapshots.
- Extract text only.

## Step 6 - Build The First Extractor

Create prompt files under:

`codes/web/prompts`

First prompt:

`extract-hospital.md`

Extractor output must be schema-validated. It should return facts only when they
are explicitly present in the source text.

Every extracted fact must include:

- Fact type
- Value
- Risk tier
- Source ID
- Exact source excerpt
- Verification status set to `UNVERIFIED`

## Step 7 - First Demo Target

By the end of the first demo, show this flow:

1. Import 5-10 hospitals from CSV.
2. Pick one hospital with a source URL.
3. Fetch the source safely.
4. Extract structured facts.
5. Show facts with source excerpts.
6. Confirm missing facts stay blank instead of guessed.

## Step 8 - Do Not Build Yet

Do not spend early time on:

- WhatsApp sending
- Appointment booking
- Patient portal features
- Full CRM views
- Complex scheduling
- Fancy AI orchestration
- Per-hospital subdomains
- Production publishing to real hospital domains

Those features do not help the first pilot answer its business question.
