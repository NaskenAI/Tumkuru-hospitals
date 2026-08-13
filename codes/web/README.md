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

## Local development environment (start here)

```bash
# 1. Local Supabase (requires Docker Desktop running)
npx supabase start          # prints API URL + service_role/anon keys
npx supabase db reset       # applies every migration in supabase/migrations

# 2. Env
cp .env.local.example .env.local
#    paste the Supabase URL + service_role key, set ADMIN_PASSWORD and
#    ADMIN_SESSION_SECRET (openssl rand -hex 32). Add LLM_API_KEY for live AI.

# 3. Run
npm run dev                 # http://localhost:3000/admin  (sign in first)

# 4. Optional: enable screenshot capture
npm i -D playwright && npx playwright install chromium

# 5. Verify everything deterministic (no Docker / no API key needed)
npm test && npm run typecheck && npm run lint && npm run build && npm run eval
```

If Docker is unavailable, all tests/typecheck/lint/build/eval still pass — they
are deterministic and do not require a database. A network-gated demo runs the
real fetch + website audit against a permitted public source:

```bash
DEMO_URL="https://tumkur.nic.in/en/public-utility/district-hospital-tumakuru/" \
  npx vitest run src/lib/research/live-audit.demo.test.ts
```

## Environment

Copy `.env.local.example` to `.env.local` and fill it in.

**Admin auth is required.** `/admin/*` and internal `/api/*` are locked behind a
password sign-in at `/admin/login`. Set both:

- `ADMIN_PASSWORD` — the shared sign-in password
- `ADMIN_SESSION_SECRET` — random string for signing the session cookie
  (`openssl rand -hex 32`)

If these are unset, the admin console and APIs stay locked. The public
`/preview/[slug]` pages and the analytics ingest endpoint stay reachable.

Fill the Supabase keys before doing a real database import. Dry-run CSV parsing
works without Supabase.

**LLM model & cost.** The provider is Google Gemini (REST v1beta). The default
model is `gemini-3.6-flash` (`LLM_MODEL`), a stable Flash model supporting
structured JSON output. Official paid-tier pricing ($1.50 input / $7.50 output
per 1M tokens) lives in `src/lib/ai/pricing.ts`; INR estimates use an
approximate `USD_TO_INR` rate. Changing `LLM_MODEL` should be paired with a
pricing row for that model.

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
