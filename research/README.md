# Research Workspace

Use this folder for prospect data, source notes, manual verification notes, and
golden fixtures.

## Research Rules

- Start from approved CSVs and manual research.
- Do not run open-ended scraping for "hospitals in Tumakuru".
- Record where every lead came from.
- Record source URL and retrieval date for every source.
- Mark manually collected information as `MANUAL`.
- Do not collect patient data.

## Suggested Files

- `prospect_seed_template.csv` - starter CSV format
- `prospects_raw/` - raw incoming CSVs from approved sources
- `prospects_clean/` - cleaned CSVs ready for import
- `source-notes/` - notes about government/public directories and manual checks
- `golden-fixtures/` - manually verified hospital fixtures for extractor tests

## Golden Fixture Rule

A golden fixture is a small manually checked record used to test extraction
quality. It should contain the correct hospital name, address, phone, website,
specialties, doctors, services, and source snippets where available.
