# Tumakuru Preview Pipeline Web App

This is the first deployable app for the Nasken AI Tumakuru hospital preview
pilot.

## Current Phase

Phase 1 foundation is started:

- Next.js app shell
- Supabase/Postgres migration
- CSV lead import parser
- Normalization and duplicate detection
- Admin import screen
- Dry-run import API
- Safe source collection service
- Extraction prompt and validation schema
- Manual extraction JSON import API

## Local Commands

```bash
npm run dev
npm run test
npm run eval        # offline extractor/guardrail evaluation (P0-6)
npm run lint
npm run typecheck
npm run build
```

Open the app at:

```text
http://localhost:3000/admin
```

## Environment

Copy `.env.example` to `.env.local` and fill it in.

**Admin auth is required.** `/admin/*` and internal `/api/*` are locked behind a
password sign-in at `/admin/login`. Set both:

- `ADMIN_PASSWORD` — the shared sign-in password
- `ADMIN_SESSION_SECRET` — random string for signing the session cookie
  (`openssl rand -hex 32`)

If these are unset, the admin console and APIs stay locked. The public
`/preview/[slug]` pages and the analytics ingest endpoint stay reachable.

Fill the Supabase keys before doing a real database import. Dry-run CSV parsing
works without Supabase.

## Human approval gates

Content cannot deploy until a human approves both languages:

```text
generate → EN_REVIEW_REQUIRED → (approve EN) → EN_APPROVED
        → translate → KN_REVIEW_REQUIRED → (approve KN) → KN_APPROVED → deploy
```

Deploy is blocked unless status is `KN_APPROVED`, both languages exist, and
English + Kannada re-pass validation. Claim validation is deterministic: every
factual claim must cite verified facts, avoid banned superlatives, and use only
numbers/names present in its supporting facts.

## Database

Apply both migrations before turning off dry run in the import UI:

```text
supabase/migrations/0001_initial_pipeline_schema.sql
supabase/migrations/0002_add_raw_html_and_constraints.sql
```

## CSV Format

Use the template in the repo root:

```text
research/prospect_seed_template.csv
```

Required columns:

- `hospital_name`
- `district`
- `city`
- `known_phone`
- `known_email`
- `known_website`
- `source_type`
- `source_url`
- `notes`

## Next Implementation Step

Build the first LLM provider call:

- Run the provider bake-off on 5-10 real pages
- Pick one provider for this phase
- Implement `extractStructured(prompt, schema)`
- Feed the result through `POST /api/leads/[leadId]/facts/import`
- Build the human fact-review screen

## Useful API Paths

Dry-run or save lead CSV rows:

```text
POST /api/leads/import?dryRun=1
POST /api/leads/import?dryRun=0
```

Collect a safe source snapshot for a lead:

```text
POST /api/leads/[leadId]/sources/collect
```

Import validated extraction JSON as unverified fact rows:

```text
POST /api/leads/[leadId]/facts/import
```
