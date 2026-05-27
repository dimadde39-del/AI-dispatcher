import { loadEnvFiles } from "./load-env";
import { DEFAULT_STT_MODE } from "./self-host-stt-common";

loadEnvFiles();

function voiceAgentUrl(): string {
  return (process.env.NEXT_PUBLIC_SELF_HOST_VOICE_AGENT_URL?.trim() || "http://localhost:8001").replace(/\/+$/u, "");
}

const url = `${voiceAgentUrl()}/stt/experiment`;

console.log(`Self-host STT experiment endpoint: ${url}

Start services:
  npm run dev
  npm run voice-agent:dev

List scenarios:
  npm run selfhost:stt-scenarios

Smoke tests:
  npm run selfhost:stt-health
  npm run selfhost:stt-mock
  npm run selfhost:stt-mock-emit

File test:
  npm run selfhost:stt-file -- --file=C:\\path\\sample.webm --scenario=ru-urgent-plumbing --mode=${DEFAULT_STT_MODE}

Modes:
  mock
  deepgram-ru-nova2 (default)
  deepgram-ru-nova3
  deepgram-multi-nova3
  deepgram-default

PowerShell audio upload example:
  curl.exe -X POST "${url}" -F "scenarioId=ru-urgent-plumbing" -F "mode=${DEFAULT_STT_MODE}" -F "file=@C:\\path\\sample.webm;type=audio/webm"

Mock scoring example:
  curl.exe -X POST "${url}" -H "content-type: application/json" -d "{\\"scenarioId\\":\\"ru-urgent-plumbing\\",\\"mode\\":\\"mock\\",\\"text\\":\\"truba test\\"}"

Deepgram modes require DEEPGRAM_API_KEY in services/voice-agent/.env. This is an STT-only experiment.
`);
