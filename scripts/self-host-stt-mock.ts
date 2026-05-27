import { loadEnvFiles } from "./load-env";
import { fetchJsonWithDiagnostics } from "../src/app/dev/selfhost-stt/fetchDiagnostics";
import { buildMockExperimentPayload, flagValue, voiceAgentUrl } from "./self-host-stt-common";

loadEnvFiles();

async function main() {
  const payload = buildMockExperimentPayload({
    text: flagValue("--text") ?? undefined,
    scenarioId: flagValue("--scenario") ?? undefined,
  });
  const url = `${voiceAgentUrl()}/stt/experiment`;
  const result = await fetchJsonWithDiagnostics<Record<string, unknown>>(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!result.ok) {
    console.error(JSON.stringify(result, null, 2));
    throw new Error(`Voice agent mock STT failed: ${result.kind}.`);
  }

  console.log(
    JSON.stringify(
      {
        url,
        scenarioId: payload.scenarioId,
        mode: result.body.mode,
        score: result.body.score,
        confidence: result.body.confidence,
        usable: result.body.usable,
        transcript: result.body.transcript,
        keywordHits: result.body.keyword_hits,
        missedKeywords: result.body.missed_keywords,
        warnings: result.body.warnings,
      },
      null,
      2,
    ),
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown self-host STT mock error";
  console.error(`Self-host STT mock failed: ${message}`);
  process.exitCode = 1;
});
