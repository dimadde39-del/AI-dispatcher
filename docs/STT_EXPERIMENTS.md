# Self-Host STT Experiments

This is a manual quality experiment for Kazakhstan RU/KZ/MIX caller audio. It is not production,
does not add LLM, does not add TTS, and does not replace Vapi.

Decision gate: choose the STT mode before starting any self-host LLM/TTS response loop.

## Modes

Configured in `services/voice-agent/app/stt_modes.py`:

| Mode | Provider | Model | Language | Notes |
| --- | --- | --- | --- | --- |
| `mock` | mock | none | none | Text passthrough for local scoring and emit checks. |
| `deepgram-ru-nova2` | Deepgram | `nova-2` | `ru` | MVP default after manual RU testing. |
| `deepgram-ru-nova3` | Deepgram | `nova-3` | `ru` | Russian-only nova-3 baseline. |
| `deepgram-multi-nova3` | Deepgram | `nova-3` | `multi` | RU/KZ code-switching research mode; not production-ready. |
| `deepgram-default` | Deepgram | not sent | not sent | Lets Deepgram choose defaults. |

Current decision: default MVP STT mode is `deepgram-ru-nova2`. RU works best in the manual samples.
KZ and mixed RU/KZ are not production-ready, and gas/safety detection is not reliable enough for
confident automation.

## Manual Results, May 2026

| Scenario | Mode | Score | Missed keywords / result |
| --- | --- | ---: | --- |
| RU urgent plumbing | `deepgram-ru-nova2` | 89 | missed `труба` |
| RU urgent plumbing | `deepgram-ru-nova3` | 66 | missed `труба`, `Шымкент`, `Нурсат` |
| RU urgent plumbing | `deepgram-multi-nova3` | 54 | missed `труба`, `течет`, `Шымкент`, `Нурсат` |
| RU urgent plumbing | `deepgram-default` | 0 | empty transcript |
| KZ water leak | `deepgram-multi-nova3` | 23 | missed `ағып`, `жатыр`, `Шымкент`, `Тұран`, `тезірек` |
| KZ water leak | `deepgram-ru-nova3` | 0 | empty transcript |
| KZ water leak | `deepgram-ru-nova2` | 0 | empty transcript |
| MIX RU/KZ water leak | `deepgram-ru-nova3` | 50 | missed `ағып`, `Шымкент`, `Тұран`, `тезірек` |
| MIX RU/KZ water leak | `deepgram-multi-nova3` | 20 | missed `су`, `ағып`, `течь`, `Шымкент`, `Тұран`, `этаж`, `тезірек` |
| MIX RU/KZ water leak | `deepgram-ru-nova2` | 0 | empty transcript |
| GAS emergency | `deepgram-multi-nova3` | 58 | missed `иісі`, `Шымкент` |
| GAS emergency | `deepgram-ru-nova3` | 58 | missed `иісі`, `Шымкент` |
| GAS emergency | `deepgram-ru-nova2` | 42 | missed `иісі`, `Шымкент`, `Нурсат` |

## Setup

```bash
cd services/voice-agent
copy .env.example .env
```

For paid Deepgram runs, set:

```bash
DEEPGRAM_API_KEY=...
STT_MODE=deepgram-ru-nova2
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
5. Save or copy/export the returned transcript, score, confidence, usability, missed keywords,
   warnings, and mode.
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
  -F "mode=deepgram-ru-nova2" `
  -F "file=@C:\path\sample.webm;type=audio/webm"
```

Scripted file upload example:

```powershell
npm run selfhost:stt-file -- --file=C:\path\sample.webm --scenario=ru-urgent-plumbing --mode=deepgram-ru-nova2
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
- Confidence and callback policy: score `< 60` adds `low_confidence`, score `< 40` is unusable,
  empty transcript is unusable, and safety scenarios below `80` add `safety_low_confidence`.

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
- Any safety scenario requires confident automation while scoring below 80.

## Low-Confidence Handling

`POST /stt/experiment` treats empty transcripts as scored results, not fatal provider errors. Empty
transcripts return HTTP 200 with `score: 0`, `confidence: "unusable"`, `usable: false`,
`requiresCallback: true`, warnings `empty_transcript` and `low_confidence`, and all scenario
keywords listed as missed.

Downstream lead handling must not create a confident normal lead from low-confidence self-host STT.
Weak but useful calls become `CALLBACK_PENDING`; empty calls without useful signal or caller phone
are logged as `NO_LEAD`.

## Next Research

Evaluate alternative RU/KZ-capable STT before production self-host automation:

- Google Speech-to-Text.
- Azure Speech.
- Whisper or faster-whisper.
- Yandex SpeechKit if viable.
- Other Kazakh-capable STT providers.

## Next Gate

After local mock emit and file/recording STT pass, pick one STT mode, document why, and only then
start the self-host LLM/TTS loop. Real phone number testing comes after the local STT pipeline works.
Vapi remains the fallback until the self-host path beats it on RU/KZ call quality and operational
reliability.
