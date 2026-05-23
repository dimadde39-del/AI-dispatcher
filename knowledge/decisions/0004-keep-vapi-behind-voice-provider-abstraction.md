# ADR 0004: Keep Vapi Behind Voice Provider Abstraction

## Status

Accepted.

## Context

Vapi is expected as the first voice-provider path, but the product should not let provider-specific payload shapes or SDK calls leak into core business logic. Voice providers may change as cost, latency, language support, margin, or operational needs evolve. Raw sources also describe a later Pipecat/self-host path.

## Decision

Place Vapi and any later Pipecat/self-host provider behind a `VoiceProvider` abstraction. Vapi webhooks and payload parsing belong in infrastructure adapters. Application use cases receive normalized call events and transcript data.

## Consequences

- Core call and lead logic remains provider-neutral.
- Raw Vapi payloads can still be stored for debugging and audit.
- Adapter work is required before application logic can consume provider events.
- Other voice providers can be evaluated later with less rewiring.
