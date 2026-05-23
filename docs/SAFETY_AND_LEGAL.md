# Safety And Legal

AI Dispatcher handles personal data and urgent service situations. Safety rules must be built into prompts, extraction logic, admin workflows, and reviews.

## AI Conversation Rules

- Do not name prices.
- Do not promise exact arrival times.
- Do not give repair advice.
- Ask only for details needed to create and route the lead.
- For gas, fire, dangerous electrical situations, or immediate danger, tell the user to call 112 or local emergency services.

## Sensitive Data

Treat these as sensitive:

- Names.
- Phone numbers.
- Addresses and districts.
- Call transcripts.
- Call recordings.
- Telegram identifiers.
- Raw provider payloads.

## Operational Rules

- Restrict access to raw payloads, transcripts, and recordings.
- Avoid broad logging of personal data.
- Define retention before production.
- Keep audit logs for important state changes.
- Do not expose diagnostic data in Telegram lead cards.
