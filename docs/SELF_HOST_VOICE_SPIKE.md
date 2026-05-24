# Self-Host Voice Spike

## Target Architecture

```text
Browser/WebRTC or test audio
-> self-host voice service
-> STT
-> LLM
-> TTS
-> normalized VoiceEvents
-> Next.js backend
-> Supabase
-> Telegram card
```

The self-host voice service lives in `services/voice-agent`. The product/backend/admin app remains
the Next.js app. Python handles realtime voice orchestration only and emits normalized events.

## Why Vapi Remains

Vapi stays in the repository because it is still the fastest fallback for a working hosted voice
orchestrator and the existing webhook foundation already connects calls to Supabase, leads, and
Telegram. The self-host spike is an evaluation path, not a production migration.

The shared contract is the provider-neutral `VoiceEvent` concept:

- `CALL_STARTED`
- `TRANSCRIPT_UPDATED`
- `CALL_ENDED`
- `UNKNOWN`

Self-host events enter through:

```text
POST /api/webhooks/self-host-voice
```

If `SELF_HOST_VOICE_WEBHOOK_SECRET` is configured, requests must include:

```text
x-self-host-voice-secret: <secret>
```

## Not Building Yet

- SIP/PSTN.
- Twilio or Zadarma integration.
- Production deployment.
- Billing.
- Marketplace, mobile app, or customer accounts.

## Spike Milestones

1. Mock transcript to `VoiceEvent` to Telegram.
2. Browser microphone to transcript.
3. STT language routing for RU/KZ.
4. LLM response loop.
5. TTS response loop.
6. Full call-end report to lead creation.
7. Only then telephony/SIP.

## Migration Gates

- RU/KZ STT quality is better than Vapi.
- End-to-end latency is acceptable.
- End-of-call lead quality is acceptable.
- No regression in the Telegram/admin pipeline.

## Local Simulation

Dry-run without writing to Supabase or sending Telegram:

```bash
npm run selfhost:simulate -- --dry-run
```

Run a specific scenario:

```bash
npm run selfhost:simulate-ru -- --dry-run
npm run selfhost:simulate-kz -- --dry-run
npm run selfhost:simulate-mix -- --dry-run
npm run selfhost:simulate-gas -- --dry-run
```

Without `--dry-run`, the script processes events through the existing `handleVoiceEvent` use case.
It creates or updates calls, creates a lead on `CALL_ENDED` when a master can be resolved, and sends a
Telegram card only when Telegram is configured.
