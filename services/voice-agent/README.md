# Self-Host Voice Agent Spike

This service is a skeleton for the self-host voice provider spike. It is not production-ready and
does not replace Vapi yet.

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
- Future Pipecat integration should live here after the mock/browser spike proves better RU/KZ
  control than Vapi.

For now, the service is expected to send events to:

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
DEEPGRAM_API_KEY=
OPENAI_API_KEY=
DEEPSEEK_API_KEY=
TTS_PROVIDER_API_KEY=
```

- `BACKEND_BASE_URL`: Next.js backend base URL.
- `SELF_HOST_VOICE_WEBHOOK_SECRET`: sent as `x-self-host-voice-secret` when configured.
- `DEEPGRAM_API_KEY`: future STT provider key.
- `OPENAI_API_KEY` or `DEEPSEEK_API_KEY`: future LLM provider key.
- `TTS_PROVIDER_API_KEY`: future TTS provider key.

## Local Skeleton

Install only the lightweight skeleton dependencies:

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Health check:

```text
GET /health
```

Do not put lead creation, Telegram formatting, Supabase writes, or billing behavior in this service.
It should only handle realtime voice orchestration and emit normalized events.
