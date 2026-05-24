# Self-Host STT Experiments

This is a manual quality experiment for Kazakhstan RU/KZ/MIX caller audio. It is not production,
does not add LLM, does not add TTS, and does not replace Vapi.

Decision gate: choose the STT mode before starting any self-host LLM/TTS response loop.

## Modes

Configured in `services/voice-agent/app/stt_modes.py`:

| Mode | Provider | Model | Language | Notes |
| --- | --- | --- | --- | --- |
| `mock` | mock | none | none | Text passthrough for local scoring and emit checks. |
| `deepgram-multi-nova3` | Deepgram | `nova-3` | `multi` | Current RU/KZ code-switching candidate. |
| `deepgram-ru-nova3` | Deepgram | `nova-3` | `ru` | Russian-only nova-3 baseline. |
| `deepgram-ru-nova2` | Deepgram | `nova-2` | `ru` | Russian-only nova-2 baseline. |
| `deepgram-default` | Deepgram | not sent | not sent | Lets Deepgram choose defaults. |

Current assumption: `language=multi&model=nova-3` is worth testing for mixed RU/KZ audio, while
Russian-only modes are baselines. Kazakh support must be proven with recordings before any migration
decision.

## Setup

```bash
cd services/voice-agent
copy .env.example .env
```

For paid Deepgram runs, set:

```bash
DEEPGRAM_API_KEY=...
STT_MODE=deepgram-multi-nova3
```

Start both services:

```bash
npm run dev
npm run voice-agent:dev
```

First required smoke checks:

```bash
npm run selfhost:stt-health
npm run selfhost:stt-mock
npm run selfhost:stt-mock-emit
```

`selfhost:stt-mock` scores a known RU transcript without Deepgram. `selfhost:stt-mock-emit` sends a
known mock transcript through `/stt/transcribe-and-emit` into the Next.js self-host webhook. It may
create a call/lead and send a Telegram card when Telegram is configured and the backend resolves a
master.

Open:

```text
http://localhost:3000/dev/selfhost-stt
```

## Record The Phrases

Use synthetic voice samples only. Do not record real client phone numbers, names, or addresses.

Record one short clip for each scenario in `services/voice-agent/app/stt_scenarios.py`:

- RU urgent plumbing
- KZ water leak
- MIX RU/KZ water leak
- GAS emergency
- ELECTRIC danger
- Noisy/unclear fallback phrase

For each clip:

1. Select the matching scenario in `/dev/selfhost-stt`.
2. Select one STT mode.
3. Read the scenario phrase naturally once in Chrome or Edge on `localhost`.
4. Click `Stop and Score`, or upload a pre-recorded `.webm`, `.wav`, or `.mp3` file.
5. Save the returned transcript, score, missed keywords, warnings, and mode in a local notes file.
6. Repeat the same audio phrase for every Deepgram mode being compared.

If the page says MediaRecorder is unavailable, the browser/context cannot record audio. Use Chrome or
Edge on `localhost`, or use file upload/mock transcript instead. If the voice-agent status is
offline, run `npm run voice-agent:dev` and open `http://localhost:8001/health`.

A Vercel-hosted copy of `/dev/selfhost-stt` cannot call a local `http://localhost:8001` voice-agent on
your laptop. Use local Next.js for local voice-agent testing, or make the voice-agent publicly
reachable and set `NEXT_PUBLIC_SELF_HOST_VOICE_AGENT_URL` intentionally.

## Manual Curl

List scenarios:

```bash
npm run selfhost:stt-scenarios
```

Show helper commands:

```bash
npm run selfhost:stt-experiment-help
```

PowerShell upload example:

```powershell
curl.exe -X POST "http://localhost:8001/stt/experiment" `
  -F "scenarioId=ru-urgent-plumbing" `
  -F "mode=deepgram-multi-nova3" `
  -F "file=@C:\path\sample.webm;type=audio/webm"
```

Scripted file upload example:

```powershell
npm run selfhost:stt-file -- --file=C:\path\sample.webm --scenario=ru-urgent-plumbing --mode=deepgram-multi-nova3
```

Mock scoring example:

```powershell
curl.exe -X POST "http://localhost:8001/stt/experiment" `
  -H "content-type: application/json" `
  -d "{\"scenarioId\":\"ru-urgent-plumbing\",\"mode\":\"mock\",\"text\":\"Труба течет под ванной. Шымкент Нурсат срочно Дима.\"}"
```

## Compare Results

Compare by scenario and mode:

- Transcript readability for a dispatcher/operator.
- Keyword hits and missed keywords.
- Wrong-language warnings.
- Whether Kazakh characters survive in KZ/MIX phrases.
- Whether emergency trigger words survive for gas/electric danger.

## Pass/Fail

Pass for a mode:

- Average score is at least 80 across the six scenarios.
- No emergency scenario loses the danger keyword (`газ`, `пахнет`, `проводка`, `искрит`, or similar).
- No RU/KZ scenario returns obvious Spanish/English junk.
- KZ and MIX scenarios preserve enough Kazakh signal to understand the lead.

Fail for a mode:

- Any emergency phrase is mistranscribed beyond operational recognition.
- KZ/MIX phrases are consistently routed as another language.
- Missed keywords prevent the master from understanding problem, district, urgency, or name.

## Next Gate

After local mock emit and file/recording STT pass, pick one STT mode, document why, and only then
start the self-host LLM/TTS loop. Real phone number testing comes after the local STT pipeline works.
Vapi remains the fallback until the self-host path beats it on RU/KZ call quality and operational
reliability.
