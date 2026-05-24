import { loadEnvFiles } from "./load-env";
import { fetchJsonWithDiagnostics } from "../src/app/dev/selfhost-stt/fetchDiagnostics";
import { voiceAgentUrl } from "./self-host-stt-common";

loadEnvFiles();

async function main() {
  const url = `${voiceAgentUrl()}/health`;
  const result = await fetchJsonWithDiagnostics(url, {
    method: "GET",
    headers: { accept: "application/json" },
  });

  if (!result.ok) {
    console.error(JSON.stringify(result, null, 2));
    throw new Error(`Voice agent health failed: ${result.kind}. ${result.fix ?? ""}`.trim());
  }

  const body = result.body as Record<string, unknown>;
  if (body.ok !== true || body.service !== "voice-agent" || !body.sttMode || !body.backendBaseUrl) {
    console.error(JSON.stringify({ url, result: body }, null, 2));
    throw new Error("Voice agent health returned an unexpected or stale shape. Restart with: npm run voice-agent:dev");
  }

  console.log(
    JSON.stringify(
      {
        url,
        result: body,
      },
      null,
      2,
    ),
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown self-host STT health error";
  console.error(`Self-host STT health failed: ${message}`);
  process.exitCode = 1;
});
