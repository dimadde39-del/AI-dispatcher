import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { loadEnvFiles } from "./load-env";
import { fetchJsonWithDiagnostics } from "../src/app/dev/selfhost-stt/fetchDiagnostics";
import {
  DEFAULT_STT_SCENARIO_ID,
  audioContentTypeForPath,
  flagValue,
  voiceAgentUrl,
} from "./self-host-stt-common";

loadEnvFiles();

async function main() {
  const file = flagValue("--file");
  if (!file) {
    throw new Error("Missing --file=C:\\path\\sample.webm");
  }

  const filePath = resolve(file);
  const scenarioId = flagValue("--scenario") ?? DEFAULT_STT_SCENARIO_ID;
  const mode = flagValue("--mode") ?? "deepgram-multi-nova3";
  const url = `${voiceAgentUrl()}/stt/experiment`;
  const bytes = await readFile(filePath);
  const contentType = audioContentTypeForPath(filePath);
  const formData = new FormData();
  formData.append("file", new Blob([new Uint8Array(bytes)], { type: contentType }), basename(filePath));
  formData.append("scenarioId", scenarioId);
  formData.append("mode", mode);

  const result = await fetchJsonWithDiagnostics<Record<string, unknown>>(url, {
    method: "POST",
    body: formData,
  });

  if (!result.ok) {
    console.error(JSON.stringify(result, null, 2));
    throw new Error(`Voice agent file STT failed: ${result.kind}.`);
  }

  console.log(
    JSON.stringify(
      {
        url,
        file: basename(filePath),
        contentType,
        scenarioId,
        mode: result.body.mode,
        score: result.body.score,
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
  const message = error instanceof Error ? error.message : "Unknown self-host STT file test error";
  console.error(`Self-host STT file test failed: ${message}`);
  process.exitCode = 1;
});
