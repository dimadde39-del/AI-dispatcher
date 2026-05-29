# Self-Host STT Experiments

This is a manual quality experiment for Kazakhstan RU/KZ/MIX caller audio. It is not production,
does not add LLM, does not add TTS, and does not replace Vapi.

Decision gate: choose the STT mode before starting any realtime self-host response LLM/TTS loop.

## Modes

Configured in `services/voice-agent/app/stt_modes.py`:

| Mode | Provider | Model | Language | Notes |
| --- | --- | --- | --- | --- |
| `mock` | mock | none | none | Text passthrough for local scoring and emit checks. |
| `deepgram-ru-nova2` | Deepgram | `nova-2` | `ru` | MVP default / recommended for Russian-first MVP behavior. |
| `deepgram-ru-nova3` | Deepgram | `nova-3` | `ru` | Experimental Russian-only baseline. |
| `deepgram-multi-nova3` | Deepgram | `nova-3` | `multi` | Experimental RU/KZ code-switching research mode; not production-ready. |
| `deepgram-default` | Deepgram | not sent | not sent | Not recommended; exported runs often return empty transcripts. |

Current decision: the MVP voice language is Russian-first, with `deepgram-ru-nova2` as the default
STT mode. Do not claim reliable Kazakh support yet. KZ-only and mixed RU/KZ calls are
callback-required fallback until a better provider or configuration is proven.

## Exported Result Summary, May 2026

| Scenario / scope | Mode | Score | Confidence | MVP conclusion |
| --- | --- | ---: | --- | --- |
| RU urgent plumbing | `deepgram-ru-nova2` | 100 | high | Best MVP default evidence. |
| Noisy/unclear fallback phrase | `deepgram-ru-nova2` | 100 | high | Handles noisy Russian fallback sample. |
| ELECTRIC danger | `deepgram-ru-nova2` | 90 | high | Electric danger works well in Russian. |
| GAS emergency | `deepgram-ru-nova2` | 74 | medium | Gas is detected, but remains `safety_low_confidence` until score is at least 80. |
| KZ-only speech | current Deepgram settings | unusable | unusable | Callback-required fallback; not production-ready. |
| MIX RU/KZ speech | current Deepgram settings | unusable | unusable | Callback-required fallback; not production-ready. |
| Deepgram defaults | `deepgram-default` | 0 | unusable | Not recommended; consistently returns empty transcripts in exports. |

Mode conclusion:

- Use `deepgram-ru-nova2` as the Russian-first MVP default and recommended Deepgram mode.
- Keep `deepgram-ru-nova3` and `deepgram-multi-nova3` as experimental comparison modes only.
- Do not recommend `deepgram-default`; it often returns empty transcripts.
- Do not claim reliable Kazakh support yet. KZ-only and mixed RU/KZ behavior needs another provider
  benchmark or a proven configuration before production use.

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
  empty transcript is unusable, and gas/safety scenarios below `80` add `safety_low_confidence`.

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

The required fallback thresholds remain:

- Score `< 60` is callback-required.
- Gas or other safety score `< 80` is `safety_low_confidence` and callback-required even when the
  danger keyword is detected.

## Noisy Transcript Cleanup

Real call transcripts are expected to contain noise, side conversations, profanity, repeated
"алло / вы слышите", and RU/KZ mixed fragments. STT scoring only measures the transcript quality;
lead quality now depends on a separate transcript-to-structured-lead layer.

The self-host webhook path runs deterministic safety hints first, then an optional strict JSON LLM
extractor. The extractor removes filler/background chatter, keeps useful details even when someone
nearby says them, and returns `LeadExtractionResult` with `summaryRu`, missing fields,
`transcriptQuality`, `confidence`, `requiresCallback`, background/profanity flags, and warnings.

Low confidence is a routing state, not an automatic discard. Useful but noisy calls become
callback-required incomplete leads. Only empty/unusable transcripts without useful signal and without
caller phone should become `NO_LEAD`.

## Next Research TODO

Benchmark alternative RU/KZ-capable STT before production self-host automation:

- Google Speech-to-Text.
- Azure Speech.
- Whisper or faster-whisper.
- Yandex/SpeechKit if viable.
- Other Kazakh-capable STT providers.

## Next Gate

After local mock emit and file/recording STT pass, pick one STT mode, document why, and only then
start the realtime self-host response LLM/TTS loop. Real phone number testing comes after the local
STT plus extraction pipeline works.
Vapi remains the fallback until the self-host path beats it on RU/KZ call quality and operational
reliability.
