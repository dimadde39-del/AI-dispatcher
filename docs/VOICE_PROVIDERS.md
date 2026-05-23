# Voice Providers

Vapi webhook integration is planned later, behind a provider abstraction.

## VoiceProvider Principle

Application code should not depend directly on Vapi SDKs, webhook payload shapes, or provider-specific status names.

## Adapter Responsibilities

- Authenticate webhook requests.
- Store raw payloads for debugging and audit.
- Normalize provider events into application-level call events.
- Capture transcript and recording references when available.
- Surface errors as retry, failed, or manual-review states.

## Application Responsibilities

- Create or update calls.
- Extract or receive lead data.
- Apply business rules.
- Trigger Telegram lead delivery.
- Record lead events and audit logs.

## Deferred

Self-host Pipecat voice stack is deferred. Do not add it until explicitly started by a future task.
