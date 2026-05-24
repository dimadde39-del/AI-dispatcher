import { loadEnvFiles } from "./load-env";

loadEnvFiles();

function voiceAgentUrl(): string {
  return (process.env.NEXT_PUBLIC_SELF_HOST_VOICE_AGENT_URL?.trim() || "http://localhost:8001").replace(/\/+$/u, "");
}

async function main() {
  const url = `${voiceAgentUrl()}/stt/scenarios`;
  const response = await fetch(url, { method: "GET" });
  const body = (await response.json()) as unknown;

  if (!response.ok) {
    throw new Error(`Voice agent scenarios request failed with HTTP ${response.status}.`);
  }

  console.log(JSON.stringify({ url, result: body }, null, 2));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown self-host STT scenarios error";
  console.error(`Self-host STT scenarios failed: ${message}`);
  console.error("Start the Python service with: npm run voice-agent:dev");
  process.exitCode = 1;
});
