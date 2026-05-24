import { pathToFileURL } from "node:url";
import { handleVoiceEvent } from "../src/application";
import { createSupabaseRepositoryContext } from "../src/infrastructure/db";
import { createTelegramMasterInterface, hasTelegramBotToken } from "../src/infrastructure/telegram";
import {
  parseSelfHostVoiceEventPayload,
  type SelfHostInternalEventPayload,
} from "../src/infrastructure/voice/self-host";
import type { VoiceEvent } from "../src/interfaces/voice-event";
import { loadEnvFiles } from "./load-env";

export type SelfHostSimulationScenario = "ru" | "kz" | "mix" | "gas";

interface SelfHostScenarioDefinition {
  transcript: string;
  summary: string;
  durationSeconds: number;
}

export const SELF_HOST_SIMULATION_SCENARIOS: Record<SelfHostSimulationScenario, SelfHostScenarioDefinition> = {
  ru: {
    transcript:
      "Здравствуйте, у меня труба течёт под ванной. Адрес Шымкент, Нурсат, дом 15. Срочно. Меня зовут Дима.",
    summary: "Клиент сообщил о протечке трубы под ванной. Адрес: Шымкент, Нурсат, дом 15. Срочно.",
    durationSeconds: 45,
  },
  kz: {
    transcript: "Су ағып жатыр. Шымкент, Тұран жақта. Тезірек керек. Атым Дима.",
    summary: "Клиент сообщил на казахском о протечке воды. Район: Шымкент, Тұран. Нужно срочно.",
    durationSeconds: 38,
  },
  mix: {
    transcript:
      "Аға, су ағып жатыр, ваннаның астынан течь. Шымкент, Тұран жақта, 5 этаж. Тезірек керек. Атым Дима.",
    summary:
      "Клиент сообщил на смешанной RU/KZ речи о течи под ванной. Адрес: Шымкент, Тұран, 5 этаж. Срочно.",
    durationSeconds: 52,
  },
  gas: {
    transcript: "Үйде газ иісі шығып тұр. Пахнет газом, не знаю что делать. Шымкент, Нурсат.",
    summary: "Клиент сообщил о запахе газа дома. Район: Шымкент, Нурсат. Требуется экстренная осторожность.",
    durationSeconds: 31,
  },
};

interface BuildSelfHostSimulationEventsInput {
  scenario: SelfHostSimulationScenario;
  providerCallId?: string;
  aiNumber?: string;
  customerPhone?: string | null;
  startedAt?: string;
}

function flagValue(name: string): string | null {
  const prefix = `${name}=`;
  const match = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : null;
}

function hasFlag(flag: string): boolean {
  return process.argv.slice(2).includes(flag);
}

function scenarioFromArgs(): SelfHostSimulationScenario {
  const scenario = flagValue("--scenario") ?? "ru";
  if (scenario === "ru" || scenario === "kz" || scenario === "mix" || scenario === "gas") {
    return scenario;
  }

  throw new Error(`Unknown self-host simulation scenario: ${scenario}`);
}

function addSeconds(timestamp: string, seconds: number): string {
  const parsed = Date.parse(timestamp);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid simulation timestamp: ${timestamp}`);
  }

  return new Date(parsed + seconds * 1000).toISOString();
}

export function buildSelfHostSimulationEvents(
  input: BuildSelfHostSimulationEventsInput,
): SelfHostInternalEventPayload[] {
  const scenario = SELF_HOST_SIMULATION_SCENARIOS[input.scenario];
  const startedAt = input.startedAt ?? new Date().toISOString();
  const endedAt = addSeconds(startedAt, scenario.durationSeconds);
  const providerCallId = input.providerCallId ?? `local-test-${input.scenario}-${Date.now()}`;
  const aiNumber = input.aiNumber ?? "web-dev";
  const customerPhone = input.customerPhone ?? null;

  return [
    {
      provider: "self-host",
      type: "call_started",
      providerCallId,
      customerPhone,
      aiNumber,
      startedAt,
    },
    {
      provider: "self-host",
      type: "transcript_updated",
      providerCallId,
      transcript: scenario.transcript,
      timestamp: addSeconds(startedAt, Math.min(10, scenario.durationSeconds)),
    },
    {
      provider: "self-host",
      type: "call_ended",
      providerCallId,
      customerPhone,
      aiNumber,
      startedAt,
      endedAt,
      durationSeconds: scenario.durationSeconds,
      transcript: scenario.transcript,
      summary: scenario.summary,
      recordingUrl: null,
    },
  ];
}

function summarizeParsedEvent(event: VoiceEvent) {
  return {
    parsedEventType: event.type,
    provider: event.provider,
    providerCallId: "providerCallId" in event ? event.providerCallId : null,
    hasTranscript: "transcript" in event ? Boolean(event.transcript) : false,
    hasSummary: "summary" in event ? Boolean(event.summary) : false,
  };
}

async function processSimulationEvent(
  payload: SelfHostInternalEventPayload,
  dryRun: boolean,
  sendTelegram: boolean,
) {
  const event = parseSelfHostVoiceEventPayload(payload);

  console.log(
    JSON.stringify(
      {
        inputEventType: payload.type,
        ...summarizeParsedEvent(event),
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

export async function runSelfHostVoiceSimulation() {
  loadEnvFiles();

  const scenario = scenarioFromArgs();
  const dryRun = hasFlag("--dry-run");
  const sendTelegram = !hasFlag("--no-telegram");
  const startedAt = flagValue("--started-at") ?? undefined;
  const providerCallId = flagValue("--provider-call-id") ?? undefined;
  const aiNumber = flagValue("--ai-number") ?? undefined;
  const events = buildSelfHostSimulationEvents({
    scenario,
    startedAt,
    providerCallId,
    aiNumber,
  });

  console.log(
    JSON.stringify(
      {
        scenario,
        eventCount: events.length,
        dryRun,
        telegramEnabled: sendTelegram,
      },
      null,
      2,
    ),
  );

  for (const event of events) {
    await processSimulationEvent(event, dryRun, sendTelegram);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runSelfHostVoiceSimulation().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown self-host voice simulation error";
    console.error(`Self-host voice simulation failed: ${message}`);
    process.exitCode = 1;
  });
}
