# Guardrails

## AI Dispatcher Safety Rules

- AI must not name prices.
- AI must not promise exact arrival times.
- AI must not give repair advice.
- AI must tell users to call 112 or local emergency services for gas, fire, dangerous electrical situations, or immediate danger.
- AI should collect only what is needed to create and route a lead.

## Personal Data

Personal data must be handled carefully. This includes:

- Client names.
- Phone numbers.
- Addresses and districts.
- Call recordings.
- Transcripts.
- Telegram identifiers.
- Provider payloads.

Raw call payloads and transcripts are sensitive. Do not expose them in public UI, broad logs, Telegram messages, or screenshots.

## Operational Guardrails

- Keep raw provider payload access restricted to diagnostic and audit contexts.
- Prefer structured audit logs for important state changes.
- Avoid storing more sensitive data than required for operations.
- Make deletion, retention, and access policies explicit before production.
