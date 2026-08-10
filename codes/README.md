# Code Workspace

Application code should live here.

Recommended first app path:

`codes/web`

## Planned Application Structure

Inside `codes/web`, use one deployable Next.js app:

- `app/admin` - internal dashboard, lead import, fact review, Kannada review
- `app/p/[slug]` - public unofficial preview pages
- `app/api` - internal endpoints used by admin UI and worker script
- `lib/research` - safe source collection and text extraction
- `lib/extraction` - LLM extraction schemas and functions
- `lib/audit` - deterministic website audit checks
- `lib/scoring` - configurable lead scoring
- `lib/ai` - thin provider wrapper
- `lib/content` - content generation and translation
- `lib/templates` - preview template schemas
- `lib/qa` - claim validation and test helpers
- `prompts` - versioned LLM prompts
- `tests` - unit and integration tests

## First Coding Milestone

Build a local flow that imports a CSV, stores leads, fetches one safe source URL,
and extracts sourced hospital facts into the database.

Do not build outreach automation or production publishing in this pilot phase.
