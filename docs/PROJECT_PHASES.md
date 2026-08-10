# Project Phases

This plan breaks the full intern project into practical phases. Each phase has
a concrete output, so progress can be demoed instead of only described.

## Phase 0 - Project Setup and Research Rules

Goal: Set up the workspace and lock the rules before writing major code.

Tasks:

- Keep all work inside the `Tumkuru-hospitals` repo folder.
- Maintain separate areas for code, research, and docs.
- Confirm approved sources for Tumakuru hospital data.
- Create the first prospect CSV format.
- Define what counts as public, manual, prohibited, and patient data.
- Decide where environment secrets will live locally.

Deliverables:

- Repo folder structure
- Scope and safety rules
- Prospect seed CSV template
- First research checklist

Exit criteria:

- You can explain what data is allowed and what is prohibited.
- You have a clean place to store code and research.

## Phase 1 - Foundation

Goal: Create the base application and database structure.

Tasks:

- Create a TypeScript Next.js app in `codes/`.
- Configure Tailwind CSS and App Router.
- Set up Supabase/Postgres connection.
- Create database schema for:
  - `leads`
  - `sources`
  - `hospital_facts`
  - `website_audits`
  - `generated_content`
  - `previews`
  - `analytics_events`
  - `jobs`
- Build CSV import for prospects.
- Add normalization-based duplicate detection.
- Add basic admin dashboard shell.

Deliverables:

- Running local app
- Database migration files
- CSV import path
- First 5-10 sample leads imported

Demo:

- Upload or load a CSV and see normalized leads in the admin dashboard.

## Phase 2 - Research, Safe Fetching, and Fact Extraction

Goal: Collect source text safely and extract structured facts without guessing.

Tasks:

- Implement safe URL fetcher.
- Allow only `http` and `https`.
- Block localhost, private IPs, reserved IPs, and unsafe redirects.
- Limit redirects, response size, and request timeout.
- Extract text only; do not execute page scripts.
- Choose one LLM provider after a short bake-off.
- Implement two simple AI functions:
  - `extractStructured(prompt, schema)`
  - `generateText(prompt, schema)`
- Add prompt files under version control.
- Extract facts into a strict Zod schema.
- Store each fact with source URL and supporting excerpt.
- Return `null` or empty arrays when facts are missing.

Deliverables:

- Safe fetcher module
- Extraction prompt
- Structured extraction schema
- Extracted fact rows with provenance

Demo:

- Given one hospital name and source URL, produce a structured fact profile with
  source excerpts.

## Phase 3 - Human Review, Website Audit, and Scoring

Goal: Let a human verify facts, then score the lead explainably.

Tasks:

- Build fact review screen.
- Support approve, edit, and reject actions.
- During the pilot, require human verification for every fact used in a preview.
- Implement deterministic website audit checks:
  - Website exists
  - HTTPS enabled
  - Mobile viewport present
  - Call CTA visible
  - Appointment CTA visible
  - WhatsApp or directions CTA visible
  - Doctors visible
  - Specialties visible
  - Title and meta description present
  - Outdated site from deterministic signals only
- Add configurable scoring.
- Generate:
  - Digital Gap Score
  - Commercial Fit Score
  - Priority score
  - Visible score explanation

Deliverables:

- Review UI
- Audit module
- Scoring config
- Lead dashboard with explainable score

Demo:

- Run one hospital through facts, review, audit, and score.

## Phase 4 - Preview Website Generation

Goal: Generate real preview websites from verified facts only.

Tasks:

- Build three fixed React templates:
  - Clinic
  - Specialty Hospital
  - Multispecialty
- Implement deterministic template selection.
- Generate English content as JSON matching a fixed template schema.
- Ensure the LLM never writes React or HTML.
- Store every factual sentence with `supporting_fact_ids`.
- Implement claim validation in TypeScript.
- Block preview generation or deployment when any claim lacks verified support.
- Use generic licensed healthcare imagery only.

Deliverables:

- Three responsive preview templates
- English generation prompt
- Claim validation gate
- Preview rendering route

Demo:

- Click generate and see a complete responsive English preview without manual
  per-hospital coding.

## Phase 5 - Kannada, Preview Hosting, and Safeguards

Goal: Make bilingual previews safe enough to show externally.

Tasks:

- Translate approved English content into Kannada.
- Preserve names and meaning exactly.
- Add Kannada review UI.
- Add disclaimer in English and approved Kannada.
- Use path-based preview URLs with unguessable slugs.
- Add `noindex, nofollow` to every preview page.
- Mark previews stale after 90 days.
- Capture desktop and mobile screenshots with Playwright.
- Test Kannada rendering on mobile and desktop.

Deliverables:

- English + Kannada preview pages
- Kannada review workflow
- Unguessable preview URLs
- Screenshots stored per preview

Demo:

- Generate one hospital preview with English and Kannada pages plus desktop and
  mobile screenshots.

## Phase 6 - Batch Processing, Jobs, Analytics, and Outreach Drafts

Goal: Run the pipeline for many hospitals with logging and cost control.

Tasks:

- Add jobs table workflow with statuses:
  - `PENDING`
  - `RUNNING`
  - `SUCCESS`
  - `FAILED`
- Build a small worker script, runnable on demand.
- Make stages safe to retry without duplicating or losing review decisions.
- Track per-job logs:
  - `lead_id`
  - `job_type`
  - `started_at`
  - `completed_at`
  - `status`
  - `error`
  - `model`
  - `tokens`
  - `estimated_cost`
- Add hard token and spend caps.
- Track only useful preview analytics:
  - `preview_opened`
  - `page_viewed`
  - `call_clicked`
  - `whatsapp_clicked`
  - `directions_clicked`
  - `contact_clicked`
- Store only coarse device category.
- Generate outreach drafts only; never send messages automatically.

Deliverables:

- Worker script
- Retry-safe jobs
- Cost tracking
- Minimal analytics
- Human-reviewed outreach drafts

Demo:

- Run a 10-hospital CSV through the batch pipeline and show results, costs, and
  draft outreach messages.

## Phase 7 - Real Pilot and Final Acceptance

Goal: Run the real pilot and prove whether the idea works.

Tasks:

- Import at least 50 real Tumakuru prospects.
- Run the full pipeline.
- Select top 10 prospects.
- Generate 5-10 high-quality bilingual previews.
- Confirm zero unsupported facts on shipped previews.
- Complete Kannada QA.
- Complete mobile QA.
- Write README, architecture note, and setup instructions.
- Record a short end-to-end demo video.

Deliverables:

- 50 prospects processed
- 5-10 external-ready previews
- Final acceptance run on 20 unseen hospitals
- Documentation and demo video

Demo:

- Given 20 unseen hospital leads, produce verified facts, scores, top 5 previews,
  screenshots, and outreach drafts.

## Strictly Out Of Scope For This Pilot

- WhatsApp, SMS, or email automation
- Google Business Profile management
- Patient portal
- Hospital management system
- Medical chatbot
- Appointment scheduling
- Payments
- ABDM clinical integration
- Full CRM
- Multi-tenant client accounts
- Production publishing to a hospital domain
- Kubernetes
- Microservices
- Message brokers
- Multi-agent frameworks
- Full multi-provider LLM abstraction layer
- Wildcard per-hospital subdomains
