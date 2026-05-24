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
3. Read the scenario phrase naturally once.
4. Click `Stop and Score`.
5. Save the returned transcript, score, missed keywords, warnings, and mode in a local notes file.
6. Repeat the same audio phrase for every Deepgram mode being compared.

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

Pick one STT mode, document why, and only then start the self-host LLM/TTS loop. Vapi remains the
fallback until the self-host path beats it on RU/KZ call quality and operational reliability.
