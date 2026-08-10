# Tumkuru Hospitals Preview Pipeline

This repo is the working home for the Nasken AI Tumakuru hospital preview pilot.
All code, research notes, seed data, fixtures, and project documents should stay
inside this `Tumkuru-hospitals` folder.

## Project Goal

Build the smallest useful system that can turn a CSV of real Tumakuru hospitals
or clinics into accurate, unofficial, bilingual preview websites that Nasken can
show to real hospital owners.

The business test is simple:

Can Nasken get a better sales conversation by showing each hospital a free,
personalized English + Kannada website preview based only on verified public or
manual facts?

## Core Rule

No unsupported fact should appear on a preview that is shown to a real hospital.

Every displayed fact must have:

- A source URL or manual source note
- An exact supporting excerpt when extracted from web text
- Human verification during the pilot phase
- Deterministic claim validation before preview deployment

## Folder Map

- `codes/` - application code and implementation notes
- `research/` - prospect research, source notes, seed CSVs, and golden fixtures
- `docs/` - project plans, phase breakdowns, scope rules, architecture notes

## Current Starting Point

Start with `docs/START_WORK_PLAN.md`, then use `docs/PROJECT_PHASES.md` as the
main milestone checklist.

Do not add out-of-scope features unless the project owner explicitly approves
them. This pilot is about getting 5-10 trustworthy previews in front of real
Tumakuru hospital owners, not building a full healthcare platform.
