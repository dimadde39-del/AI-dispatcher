import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { handleVoiceEvent } from "../src/application";
import { createSupabaseRepositoryContext } from "../src/infrastructure/db";
import { createTelegramMasterInterface, hasTelegramBotToken } from "../src/infrastructure/telegram";
import { parseVapiWebhookPayload } from "../src/infrastructure/voice/vapi";
import { loadEnvFiles } from "./load-env";

const DEFAULT_FIXTURE = "tests/fixtures/vapi-end-of-call-report.json";
const ALL_FIXTURES = [
  "tests/fixtures/vapi-call-started.json",
  "tests/fixtures/vapi-transcript-update.json",
  "tests/fixtures/vapi-end-of-call-report.json",
  "tests/fixtures/vapi-unknown-event.json",
];

function flagValue(name: string): string | null {
  const prefix = `${name}=`;
  const match = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : null;
}

function hasFlag(flag: string): boolean {
  return process.argv.slice(2).includes(flag);
}

function readFixture(filePath: string): unknown {
  const absolutePath = resolve(process.cwd(), filePath);
  return JSON.parse(readFileSync(absolutePath, "utf8")) as unknown;
}

async function processFixture(filePath: string, dryRun: boolean, sendTelegram: boolean) {
  const payload = readFixture(filePath);
  const event = parseVapiWebhookPayload(payload);

  console.log(
    JSON.stringify(
      {
        fixture: filePath,
        parsedEventType: event.type,
        providerCallId: "providerCallId" in event ? event.providerCallId : null,
        hasTranscript: "transcript" in event ? Boolean(event.transcript) : false,
        hasSummary: "summary" in event ? Boolean(event.summary) : false,
        hasRecording: "recordingUrl" in event ? Boolean(event.recordingUrl) : false,
        dryRun,
      },
      null,
      2,
    ),
  );

  if (dryRun) {
    return;
  }

  const repositories = createSupabaseRepositoryContext();
  const masterInterface = sendTelegram && hasTelegramBotToken() ? createTelegramMasterInterface() : undefined;
  const result = await handleVoiceEvent(repositories, event, {
    masterInterface,
    sendTelegramLeadCard: sendTelegram,
  });

  console.log(
    JSON.stringify(
      {
        ok: result.ok,
        eventType: result.eventType,
        callId: result.callId,
        leadId: result.leadId,
        telegramMessageId: result.telegramMessageId,
        ignored: result.ignored ?? false,
        reason: result.reason,
        telegramConfigured: Boolean(masterInterface),
      },
      null,
      2,
    ),
  );
}

async function main() {
  loadEnvFiles();

  const dryRun = hasFlag("--dry-run");
  const sendTelegram = !hasFlag("--no-telegram");
  const fixtures = hasFlag("--all") ? ALL_FIXTURES : [flagValue("--fixture") ?? DEFAULT_FIXTURE];

  for (const fixture of fixtures) {
    await processFixture(fixture, dryRun, sendTelegram);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown Vapi simulation error";
  console.error(`Vapi simulation failed: ${message}`);
  process.exitCode = 1;
});
