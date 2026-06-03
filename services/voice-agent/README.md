# Self-Host Voice Agent

This service is the upload-based STT milestone for the selected self-host voice direction. It is not
production-ready yet. Existing Vapi code is legacy benchmark or contingency tooling only.

The current goal is to prove that a self-host voice runtime can emit normalized voice events into the
existing Next.js backend:

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

## Current Status

- No SIP or PSTN integration.
- No Twilio, Zadarma, or other telephony provider integration.
- No production deployment plan.
- No billing.
- No duplicated lead or Telegram logic in Python.
- Upload-based STT endpoints only; no realtime streaming agent yet.
- Future realtime orchestration should live here after the mock/browser path proves acceptable
  Russian-first quality and safe KZ/mixed RU/KZ fallback handling.

For now, the service can transcribe mock text or uploaded audio, then send normalized events to:

```text
POST /api/webhooks/self-host-voice
```

Use the Next.js simulation script first:

```bash
npm run selfhost:simulate -- --dry-run
```

## Environment

```bash
BACKEND_BASE_URL=http://localhost:3000
SELF_HOST_VOICE_WEBHOOK_SECRET=
STT_PROVIDER=mock
STT_MODE=deepgram-ru-nova2
STT_LANGUAGE_MODE=ru-kk
DEEPGRAM_MODEL=nova-3
DEEPGRAM_API_KEY=
GOOGLE_STT_ENABLED=false
GOOGLE_STT_API_KEY=
GOOGLE_APPLICATION_CREDENTIALS=
AZURE_STT_ENABLED=false
AZURE_SPEECH_KEY=
AZURE_SPEECH_REGION=
WHISPER_LOCAL_ENABLED=false
OPENAI_API_KEY=
DEEPSEEK_API_KEY=
TTS_PROVIDER_API_KEY=
```

- `BACKEND_BASE_URL`: Next.js backend base URL.
- `SELF_HOST_VOICE_WEBHOOK_SECRET`: sent as `x-self-host-voice-secret` when configured.
- `STT_PROVIDER`: legacy provider selector. `mock` is still used for explicit mock requests and
  zero-cost local checks.
- `STT_MODE`: named experiment mode. The MVP default / recommended mode is
  `deepgram-ru-nova2` for Russian-first behavior. Use `deepgram-ru-nova3` and
  `deepgram-multi-nova3` only as experimental paid Deepgram comparisons. Do not recommend
  `deepgram-default`; exported runs often returned empty transcripts.
- `STT_LANGUAGE_MODE`: legacy Deepgram language mode used only when `STT_PROVIDER=deepgram` is used
  without a named `STT_MODE`.
- `DEEPGRAM_MODEL`: legacy Deepgram model used only when `STT_PROVIDER=deepgram` is used without a
  named `STT_MODE`.
- `DEEPGRAM_API_KEY`: optional STT provider key.
- `GOOGLE_STT_ENABLED`: opt-in switch for Google Speech-to-Text upload benchmarks. Default `false`.
- `GOOGLE_STT_API_KEY` or `GOOGLE_APPLICATION_CREDENTIALS`: optional Google STT credentials for
  `google-kk`, `google-ru`, and `google-ru-kk-auto`.
- `AZURE_STT_ENABLED`: opt-in switch for Azure Speech upload benchmarks. Default `false`.
- `AZURE_SPEECH_KEY` and `AZURE_SPEECH_REGION`: optional Azure Speech credentials for `azure-kk` and
  `azure-ru`.
- `WHISPER_LOCAL_ENABLED`: documented future local Whisper switch. The faster-whisper dependency and
  model are intentionally not installed yet.
- `OPENAI_API_KEY` or `DEEPSEEK_API_KEY`: future LLM provider key.
- `TTS_PROVIDER_API_KEY`: future TTS provider key.

## Local Skeleton

Install only the lightweight skeleton dependencies:

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8001 --env-file .env
```

Health check:

```text
GET /health
```

Safe health response shape:

```json
{
  "ok": true,
  "service": "voice-agent",
  "sttProvider": "mock",
  "sttMode": "deepgram-ru-nova2",
  "backendBaseUrl": "http://localhost:3000"
}
```

The response must not include API keys, webhook secrets, raw provider payloads, transcripts, or
recordings.

STT endpoints:

```text
POST /stt/transcribe
POST /stt/transcribe-and-emit
POST /stt/experiment
GET /stt/modes
GET /stt/scenarios
```

Mock JSON:

```json
{
  "provider": "mock",
  "text": "Здравствуйте, у меня труба течёт под ванной."
}
```

Audio upload uses multipart form field `file`. Uploaded audio is sent to the selected provider:
Deepgram `/v1/listen`, Google `speech:recognize`, or Azure Speech short-audio REST. With
`STT_MODE=deepgram-ru-nova2`, the service sends `language=ru&model=nova-2`. Google and Azure modes
use official `kk-KZ` and `ru-RU` language codes where configured. Azure REST upload expects WAV PCM
or OGG OPUS, not browser `.webm`. Treat every external mode as a quality test, not a guarantee. Do
not claim reliable Kazakh support yet.

`POST /stt/experiment` accepts `scenarioId`, optional `mode`, and an uploaded audio `file`. For local
scorer checks it also accepts JSON with `mode=mock` and `text`. Empty transcripts return HTTP 200
with `score: 0`, `confidence: "unusable"`, `usable: false`, callback-required warnings, and all
expected keywords marked missed.

Exported STT results set the MVP default to `deepgram-ru-nova2`: RU urgent plumbing scored 100/high,
noisy fallback scored 100/high, electric danger scored 90/high, and gas emergency scored 74/medium.
Gas is detected but remains `safety_low_confidence` unless score is at least 80. KZ/MIX is
callback-required fallback, not production-ready. Current rescue-track candidates are Google
Speech-to-Text, Azure Speech, and later Whisper/faster-whisper.

Do not put lead creation, Telegram formatting, Supabase writes, or billing behavior in this service.
It should only handle voice/STT orchestration and emit normalized events.
