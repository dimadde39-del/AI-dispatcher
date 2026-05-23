# Open Questions

## Product

- Which first ICP should be used for the pilot: plumber, washing machine repair, fridge repair, electrician, locksmith, or conditioner installer?
- Which cities or regions in Kazakhstan are first priority?
- Which languages should the AI dispatcher support at launch?
- What counts as an accepted lead for reporting and billing?
- What lead details are mandatory versus optional?

## Operations

- Who reviews failed extractions or low-confidence transcripts?
- How should masters be onboarded and verified?
- What is the manual fallback when Telegram delivery fails?
- What retention period is required for transcripts, recordings, and raw provider payloads?

## Technical

- Which app stack will be used once product foundation begins?
- What Supabase project and environments will be used for dev, staging, and production?
- What webhook authentication scheme will be used for Vapi and Telegram?
- What audit log events are required for launch?
- Raw `06_TECHNICAL_ARCHITECTURE.md` proposes SQLite and Beeline Cloud, while the current operating-system task requires Supabase. Confirm whether Supabase remains final for v0 foundation.
- Raw files appear encoding-garbled when read normally. Confirm whether to preserve as-is forever or add clean translated copies outside `knowledge/raw/`.
- Which local Kazakhstan SIP provider should be tested first: Zadarma KZ, OnlinePBX.kz, or Kazakhtelecom?
