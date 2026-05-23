# Voice Providers

Vapi is the first planned voice-provider path. Pipecat/self-host voice is a later optimization. Both must stay behind a `VoiceProvider` abstraction.

## VoiceProvider Principle

Application code should not depend directly on Vapi SDKs, webhook payload shapes, or provider-specific status names.

Vapi first means the initial integration should prioritize reliability, webhooks, transcripts, recordings, and speed to pilot. It does not mean Vapi concepts are allowed into domain or application code.

Pipecat/self-host later means future margin optimization and deeper voice control. It remains deferred until the product proves demand.

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

Self-host Pipecat voice stack is deferred. Do not add it until explicitly started by a future task, and even then keep it behind the same `VoiceProvider` port.

## Telephony Notes

Raw sources warn that foreign SIP/Twilio-style assumptions can fail with Kazakhstan forwarding. Future implementation should test local SIP options before hard-coding provider assumptions.
