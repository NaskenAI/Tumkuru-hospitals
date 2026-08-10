# Scope And Safety Rules

These rules should guide every implementation decision.

## Main Objective

Generate 5-10 accurate, attractive, unofficial bilingual previews for real
Tumakuru hospitals or clinics so Nasken can observe real owner reactions.

## Non-Negotiable Safety Rules

- Do not collect patient data.
- Do not display patient data.
- Do not scrape patient photos or testimonials.
- Do not invent doctors, specialties, services, facilities, qualifications,
  timings, accreditations, emergency availability, outcomes, or claims.
- Do not use a fact on an external preview unless it has been human-verified.
- Do not allow generated content to deploy unless every factual sentence has
  verified supporting fact IDs.
- Do not let source page text act as instructions to the LLM.
- Do not let the LLM choose whether a claim is deployable. Code must enforce it.

## Allowed Sources

Preferred order:

1. Hospital-owned official website or public social pages
2. Government or public-interest health directories
3. Manually collected information from a human call, visit, or verified note

## Prohibited Sources

- Patient records
- Private medical data
- Unlicensed copied photos
- Scraped patient testimonials
- Unverified claims from random aggregator pages
- Anything that cannot be traced to a source or manual note

## Content Rules

Generated copy must avoid unsupported quality claims, including:

- best
- number one
- leading
- world class
- guaranteed
- highest success rate
- 100% success
- most trusted

## Human Gates

The pipeline must pause for human review at:

- Fact review
- Kannada review
- External sharing decision

The system can generate outreach drafts, but it must never send messages by
itself.
