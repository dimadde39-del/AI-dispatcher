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

## MVP Behavior After STT Export

The MVP voice language is Russian-first. The current Deepgram evidence supports
`deepgram-ru-nova2` as the recommended default for Russian calls, not as proof of reliable Kazakh
support.

KZ-only and mixed RU/KZ calls are callback-required fallback. They are not production-ready with the
current Deepgram settings, and product or sales docs must not claim reliable Kazakh support yet.

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

Score a zero-cost mock transcript through the Python service before trying live STT:

```bash
npm run selfhost:stt-mock
```

Then test the full mock emit path into the Next.js self-host webhook:

```bash
npm run selfhost:stt-mock-emit
```

`selfhost:stt-mock-emit` may create a call/lead and may send a Telegram card when Telegram is
configured and the backend resolves a master. It prints safe IDs and status fields only.

Open the dev page:

```text
http://localhost:3000/dev/selfhost-stt
```

The page supports:

- Voice-agent health diagnostics with the exact URL and fix command when offline.
- Browser microphone recording upload when MediaRecorder is available.
- File upload fallback for `.webm`, `.wav`, and `.mp3` samples.
- Local typed mock transcript scoring even when the voice-agent is offline.
- Typed mock transcript emission through the Python service when the voice-agent is online.
- Scenario selection for RU, KZ, mixed RU/KZ, gas, electric danger, and noisy fallback phrases.
- STT mode selection for mock plus Deepgram baselines.
- `/stt/experiment` scoring with keyword hits, missed keywords, language signals, and warnings.
- Safe event/result logs.

Use Chrome or Edge on `localhost` for browser recording. Some embedded browsers and remote contexts
do not expose `MediaRecorder`; in that case use the file upload or local mock transcript path. A
Vercel-hosted dev page cannot call `http://localhost:8001` on your laptop unless the voice-agent is
publicly reachable and configured in `NEXT_PUBLIC_SELF_HOST_VOICE_AGENT_URL`.

Deepgram is optional. Set this only when intentionally testing external STT:

```bash
STT_PROVIDER=deepgram
STT_MODE=deepgram-ru-nova2
DEEPGRAM_API_KEY=...
```

The named mode assumptions live in `services/voice-agent/app/stt_modes.py`. The current MVP default
is `deepgram-ru-nova2`. Exported results scored it at 100/high for RU urgent plumbing, 100/high for
the noisy fallback phrase, 90/high for electric danger, and 74/medium for gas emergency. Gas is
detected, but remains `safety_low_confidence` until the score is at least 80. The
`deepgram-ru-nova3` and `deepgram-multi-nova3` modes remain experimental comparisons, not defaults.
`deepgram-default` is not recommended because exported runs often returned empty transcripts.

Important caveat: Deepgram's current model/language overview clearly lists Russian for Nova-3, but
Kazakh is not clearly listed there. RU/KZ mixed quality must be measured with real recordings before
any migration decision.

Low-confidence behavior is required before any self-host production use:

- `/stt/experiment` returns empty transcripts as HTTP 200 scored results with `score: 0`,
  `confidence: "unusable"`, `usable: false`, and callback-required warnings.
- Score `< 60` is low confidence; score `< 40` is unusable.
- Gas/electric safety scenarios below 80 add `safety_low_confidence`; gas remains low-confidence
  safety handling unless the score is at least 80.
- Low-confidence self-host call-end events create only `CALLBACK_PENDING` leads when there is useful
  signal or a caller phone; empty calls without useful signal become `NO_LEAD`.

## Noise-Aware Lead Extraction

Self-host STT output is expected to be messy in real calls: unclear words, background family speech,
profanity, repeated "алло / вы слышите", partial phrases, and mixed RU/KZ fragments. The backend now
keeps deterministic extraction as a safety/fallback layer, then optionally runs a strict JSON LLM
lead extractor:

```text
raw transcript
-> deterministic safety hints
-> LLM cleanup/extraction
-> LeadExtractionResult
-> lead creation and Telegram card
```

Configure the extractor with:

```bash
LEAD_EXTRACTOR_PROVIDER=mock
LEAD_EXTRACTOR_MODEL=deepseek-chat
```

`mock` is local and test-safe. `deepseek` and `openai` are optional provider boundaries and require
their API keys before they are used. Tests must not call real providers.

Low confidence does not mean the call is thrown away. If the transcript contains a useful problem or
there is a caller phone, the system creates an incomplete `CALLBACK_PENDING` lead and the Telegram
card shows "AI-выжимка", missing fields, and a warning to call the client back. Only empty/unusable
calls with no useful signal and no caller phone become `NO_LEAD`.

`npm run vapi:recent` is not relevant for self-host calls. Verify self-host output through:

- `/admin/calls`
- `/admin/leads`
- Telegram card delivery
- Supabase `calls.provider = self-host`

Detailed manual experiment steps and observed score tables are in `docs/STT_EXPERIMENTS.md`. Next
research TODO: compare Google Speech-to-Text, Azure Speech, Whisper/faster-whisper, Yandex/SpeechKit
if viable, and other Kazakh-capable STT before adding any realtime self-host response LLM/TTS loop.
