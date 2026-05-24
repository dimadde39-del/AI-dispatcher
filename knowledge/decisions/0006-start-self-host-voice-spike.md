# ADR 0006: Start Self-Host Voice Spike

## Status

Accepted.

## Context

The first live Vapi Web Call technically started, but the realtime voice path was unreliable for the
Kazakhstan RU/KZ use case:

- DeepSeek inside Vapi failed with a provider fault.
- Switching to `gpt-4o-mini` avoided the provider crash.
- The Deepgram/Vapi multilingual pipeline misdetected RU/KZ speech and the assistant responded in
  Spanish.

For mixed Russian and Kazakh speech, the product needs more control over STT, language routing, and
runtime behavior than the current Vapi setup exposed during the test.

## Decision

Start a self-host voice provider spike while keeping Vapi in the repo as a fallback. The spike lives
under `services/voice-agent` and emits normalized self-host voice events to the existing Next.js
backend through `/api/webhooks/self-host-voice`.

The existing backend, Supabase persistence, lead extraction, and Telegram lead-card pipeline remain
the source of truth. The Python service must not duplicate lead or Telegram logic.

## Consequences

- The team gets more control over STT and RU/KZ language routing.
- The architecture carries more engineering complexity.
- No production migration happens until the spike proves call quality.
- Existing backend and Telegram pipeline remains the source of truth.
- Vapi remains available as the fallback voice provider and its webhook foundation stays intact.
