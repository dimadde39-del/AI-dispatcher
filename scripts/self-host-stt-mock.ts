import { loadEnvFiles } from "./load-env";

const DEFAULT_TRANSCRIPT =
  "Здравствуйте, у меня труба течёт под ванной. Адрес Шымкент, Нурсат, дом 15. Срочно. Меня зовут Дима.";

loadEnvFiles();

function flagValue(name: string): string | null {
  const prefix = `${name}=`;
  const match = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : null;
}

function voiceAgentUrl(): string {
  return (process.env.NEXT_PUBLIC_SELF_HOST_VOICE_AGENT_URL?.trim() || "http://localhost:8001").replace(/\/+$/u, "");
}

async function main() {
  const text = flagValue("--text") ?? DEFAULT_TRANSCRIPT;
  const url = `${voiceAgentUrl()}/stt/transcribe-and-emit`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      provider: "mock",
      text,
    }),
  });
  const body = (await response.json()) as unknown;

  if (!response.ok) {
    throw new Error(`Voice agent mock STT failed with HTTP ${response.status}.`);
  }

  console.log(JSON.stringify(body, null, 2));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown self-host STT mock error";
  console.error(`Self-host STT mock failed: ${message}`);
  process.exitCode = 1;
});
