# ADR 0004: Keep Vapi Behind Voice Provider Abstraction

## Status

Accepted.

## Context

Vapi is expected for voice webhook integration later, but the product should not let provider-specific payload shapes or SDK calls leak into core business logic. Voice providers may change as cost, latency, language support, or operational needs evolve.

## Decision

Place Vapi behind a `VoiceProvider` abstraction. Vapi webhooks and payload parsing belong in infrastructure adapters. Application use cases receive normalized call events and transcript data.

## Consequences

- Core call and lead logic remains provider-neutral.
- Raw Vapi payloads can still be stored for debugging and audit.
- Adapter work is required before application logic can consume provider events.
- Other voice providers can be evaluated later with less rewiring.
