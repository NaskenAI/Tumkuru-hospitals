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
npm run lint
npm run typecheck
npm run build
```

Open the app at:

```text
http://localhost:3000/admin
```

## Environment

Copy `.env.example` to `.env.local` and fill the Supabase keys before doing a
real database import.

Dry-run CSV parsing works without Supabase.

## Database

The first migration is:

```text
supabase/migrations/0001_initial_pipeline_schema.sql
```

Apply it to the Supabase project before turning off dry run in the import UI.

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
