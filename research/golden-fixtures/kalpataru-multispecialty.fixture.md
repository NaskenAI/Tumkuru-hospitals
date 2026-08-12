# Kalpataru Multispecialty Hospital (FICTIONAL golden fixture)

> This is a fabricated record used only for extractor evaluation. It does not
> describe a real hospital. Machine-readable copy: `codes/web/src/eval/fixtures.ts`.

- **Source URL:** https://kalpataruhospital.example/about
- **Retrieval date:** 2026-08-01
- **Template:** multispecialty

## Source text (as a safe fetch would extract)

```
Kalpataru Multispecialty Hospital, B.H. Road, Tumakuru 572101. Phone:
0816-2345678. Email: care@kalpataruhospital.example. We provide Cardiology,
Orthopedics, and General Medicine. Our doctors include Dr. Suresh Kumar
(MBBS, MD) and Dr. Anitha Rao (MBBS, DGO). Open 24 hours for emergency care.
Ambulance service available.
```

## Correct (gold) facts

| Type | Value |
|------|-------|
| HOSPITAL_NAME | Kalpataru Multispecialty Hospital |
| ADDRESS | B.H. Road, Tumakuru 572101 |
| PHONE | 0816-2345678 |
| EMAIL | care@kalpataruhospital.example |
| SPECIALTY | Cardiology / Orthopedics / General Medicine |
| DOCTOR | Dr. Suresh Kumar; Dr. Anitha Rao |
| EMERGENCY | Open 24 hours for emergency care |

## Facts that must remain null

- Accreditations (none stated)
- Insurance networks (none stated)
- Any procedure success rates (never stated; must never be invented)

## Planted hallucination (must be rejected)

- `FACILITY: "3 Tesla MRI scanner"` with an excerpt that does not appear in the
  source. Excerpt verification (P0-7) must drop it.
