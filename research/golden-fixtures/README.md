# Golden Fixtures

Create one fixture file per hospital used for extraction testing.

Recommended filename:

`hospital-name.fixture.md`

Each fixture should include:

- Hospital name
- Source URLs used
- Retrieval date
- Correct phone number, if public
- Correct address, if public
- Correct specialties, if public
- Correct doctors and qualifications, if public
- Correct services, if public
- Facts that are unknown and must remain null
- Any conflicting facts found across sources

Use these fixtures to measure:

- Extraction precision
- Extraction recall
- Unsupported-fact rate
- Prompt-injection resistance
