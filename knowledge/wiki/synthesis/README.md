# Synthesis

Use this folder for cross-source conclusions and recommendations.

Synthesis notes should be clear about what is known, what is inferred, and what remains uncertain. They should not replace raw sources or ADRs.

## Initial Synthesis

AI Dispatcher should be built as a narrow B2B SaaS wedge for urgent field-service masters in Kazakhstan. The first product proof is accepted leads from missed calls, not conversational sophistication.

## Product Shape

- The buyer feels pain when a missed call turns into a lost order within seconds.
- The strongest interface for the master is Telegram because it turns messy audio into a short actionable card.
- The AI's job is to collect and qualify, not diagnose, price, or promise.
- Weekly value reports are important because they make saved orders visible and reduce churn.

## Architecture Shape

- Keep voice providers behind `VoiceProvider`: Vapi first, Pipecat/self-host later.
- Keep Telegram behind `Notification` or `MasterInterface`.
- Store raw provider payloads for debugging, but keep them restricted.
- Use Supabase Postgres for the foundation per the current operating-system decision, despite one raw source proposing SQLite.

## Scope Discipline

- v0/v1 should focus on foundation, missed-call capture, Telegram lead cards, extraction, and pilot operations.
- Anti-no-show confirmations, deposits, CRM upsell, squad mode, and marketplace belong later.
- Marketplace should wait until there is a strong supply base, not appear in the initial app architecture.
