# Self-Host Voice Agent Spike

This service is the upload-based STT milestone for the self-host voice provider spike. It is not
production-ready and does not replace Vapi yet.

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
- Future Pipecat integration should live here after the mock/browser spike proves better RU/KZ
  control than Vapi.

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
STT_MODE=mock
STT_LANGUAGE_MODE=ru-kk
DEEPGRAM_MODEL=nova-3
DEEPGRAM_API_KEY=
OPENAI_API_KEY=
DEEPSEEK_API_KEY=
TTS_PROVIDER_API_KEY=
```

- `BACKEND_BASE_URL`: Next.js backend base URL.
- `SELF_HOST_VOICE_WEBHOOK_SECRET`: sent as `x-self-host-voice-secret` when configured.
- `STT_PROVIDER`: `mock` by default. The legacy `deepgram` value still works when
  `DEEPGRAM_API_KEY` is configured.
- `STT_MODE`: named experiment mode. Use `deepgram-multi-nova3`, `deepgram-ru-nova3`,
  `deepgram-ru-nova2`, or `deepgram-default` for paid Deepgram comparisons.
- `STT_LANGUAGE_MODE`: legacy Deepgram language mode used only when `STT_PROVIDER=deepgram` is used
  without a named `STT_MODE`.
- `DEEPGRAM_MODEL`: legacy Deepgram model used only when `STT_PROVIDER=deepgram` is used without a
  named `STT_MODE`.
- `DEEPGRAM_API_KEY`: optional STT provider key.
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
  "sttMode": "mock",
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

Audio upload uses multipart form field `file`. With `STT_PROVIDER=deepgram`, uploaded audio is sent
to Deepgram's pre-recorded `/v1/listen` API. With `STT_MODE=deepgram-multi-nova3`, the service sends
`language=multi&model=nova-3`. Treat every Deepgram mode as a quality test, not a guarantee.

`POST /stt/experiment` accepts `scenarioId`, optional `mode`, and an uploaded audio `file`. For local
scorer checks it also accepts JSON with `mode=mock` and `text`.

Do not put lead creation, Telegram formatting, Supabase writes, or billing behavior in this service.
It should only handle voice/STT orchestration and emit normalized events.
