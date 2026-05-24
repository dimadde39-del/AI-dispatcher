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
2. Browser microphone to transcript. Done as upload-based STT spike.
3. STT language routing for RU/KZ. Current experiment framework is in place.
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

## Upload-Based STT Milestone

Milestone 2 uses a simple browser recording upload flow, not realtime streaming:

```text
/dev/selfhost-stt
-> services/voice-agent POST /stt/transcribe-and-emit
-> Deepgram or mock STT
-> self-host VoiceEvents
-> /api/webhooks/self-host-voice
-> Supabase and Telegram
```

Run the Python voice-agent:

```bash
npm run voice-agent:dev
```

Check health:

```bash
npm run selfhost:stt-health
```

Emit a zero-cost mock transcript through the Python service:

```bash
npm run selfhost:stt-mock
```

Open the dev page:

```text
http://localhost:3000/dev/selfhost-stt
```

The page supports:

- Browser microphone recording upload.
- Typed mock transcript emission.
- Scenario selection for RU, KZ, mixed RU/KZ, gas, electric danger, and noisy fallback phrases.
- STT mode selection for mock plus Deepgram baselines.
- `/stt/experiment` scoring with keyword hits, missed keywords, language signals, and warnings.
- Safe event/result logs.

Deepgram is optional. Set this only when intentionally testing external STT:

```bash
STT_PROVIDER=deepgram
STT_MODE=deepgram-multi-nova3
DEEPGRAM_API_KEY=...
```

The named mode assumptions live in `services/voice-agent/app/stt_modes.py`. The primary candidate is
`deepgram-multi-nova3`, which sends `language=multi&model=nova-3`; the RU-only nova-3 and nova-2
modes are baselines, and `deepgram-default` sends no explicit model or language.

Important caveat: Deepgram's current model/language overview clearly lists Russian for Nova-3, but
Kazakh is not clearly listed there. RU/KZ mixed quality must be measured with real recordings before
any migration decision.

`npm run vapi:recent` is not relevant for self-host calls. Verify self-host output through:

- `/admin/calls`
- `/admin/leads`
- Telegram card delivery
- Supabase `calls.provider = self-host`

Detailed manual experiment steps are in `docs/STT_EXPERIMENTS.md`. Choose the STT mode before adding
any self-host LLM/TTS loop.
