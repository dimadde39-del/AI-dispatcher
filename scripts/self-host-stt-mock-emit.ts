import { loadEnvFiles } from "./load-env";
import { fetchJsonWithDiagnostics } from "../src/app/dev/selfhost-stt/fetchDiagnostics";
import { buildMockEmitPayload, flagValue, safeBackendResults, voiceAgentUrl } from "./self-host-stt-common";

loadEnvFiles();

async function main() {
  const payload = buildMockEmitPayload(flagValue("--text") ?? undefined);
  const url = `${voiceAgentUrl()}/stt/transcribe-and-emit`;
  const telegramConfigured = Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim());

  console.log(
    JSON.stringify(
      {
        url,
        action: "mock-transcribe-and-emit",
        telegramConfigured,
        telegramNote: telegramConfigured
          ? "Telegram may send a lead card if the backend resolves a master with telegram_chat_id."
          : "Telegram is not configured; backend should skip card delivery.",
      },
      null,
      2,
    ),
  );

  const result = await fetchJsonWithDiagnostics<Record<string, unknown>>(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!result.ok) {
    console.error(JSON.stringify(result, null, 2));
    throw new Error(`Voice agent mock emit failed: ${result.kind}.`);
  }

  console.log(
    JSON.stringify(
      {
        ok: result.body.ok,
        provider: result.body.provider,
        mode: result.body.mode,
        providerCallId: result.body.providerCallId,
        transcriptLength: typeof result.body.transcript === "string" ? result.body.transcript.length : 0,
        emittedEvents: result.body.emittedEvents,
        telegramConfigured,
        backendResults: safeBackendResults(result.body.backendResults),
      },
      null,
      2,
    ),
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown self-host STT mock emit error";
  console.error(`Self-host STT mock emit failed: ${message}`);
  process.exitCode = 1;
});
